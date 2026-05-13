from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import asyncpg


def _decode_jsonb(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value


def _connection_payload(row: asyncpg.Record) -> dict:
    payload = dict(row)
    payload["config"] = _decode_jsonb(payload.get("config")) or {}
    return payload


async def fetch_due_connection_ids(conn: asyncpg.Connection, limit: int = 100) -> list[UUID]:
    rows = await conn.fetch(
        """
        SELECT w.id
        FROM workers.watchers w
        WHERE COALESCE(w.next_poll_at, now()) <= now()
        ORDER BY COALESCE(w.next_poll_at, w.created_at)
        LIMIT $1
        """,
        limit,
    )
    return [row["id"] for row in rows]


async def fetch_connection(conn: asyncpg.Connection, connection_id: UUID) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT
            w.id,
            nw.project_id,
            nw.id AS ner_workflow_id,
            pr.active_prompt_id,
            sc.id AS source_connection_id,
            sc.provider,
            sp.provider AS display_name,
            sc.config,
            w.poll_interval_seconds,
            s.id AS source_id
        FROM workers.watchers w
        JOIN core.sources s ON s.id = w.pdf_source_id
        JOIN core.source_connections sc ON sc.id = s.source_connection_id
        JOIN public.source_providers sp ON sp.id = sc.provider
        JOIN workers.ner_workflows nw ON nw.watcher_id = w.id
        JOIN web.projects pr ON pr.id = nw.project_id
        WHERE w.id = $1
        """,
        connection_id,
    )
    return _connection_payload(row) if row is not None else None


async def fetch_cursor(conn: asyncpg.Connection, connection_id: UUID) -> dict | None:
    row = await conn.fetchrow(
        "SELECT cursor FROM workers.watchers WHERE id = $1",
        connection_id,
    )
    return _decode_jsonb(row["cursor"]) if row else None


async def insert_watch_run(
    conn: asyncpg.Connection,
    connection_id: UUID,
    cursor_before: dict | None,
) -> int:
    return await conn.fetchval(
        """
        INSERT INTO workers.watcher_runs (watcher_id, status, cursor_before)
        VALUES ($1, 'running', $2::jsonb)
        RETURNING id
        """,
        connection_id,
        json.dumps(cursor_before) if cursor_before is not None else None,
    )


async def complete_watch_run(
    conn: asyncpg.Connection,
    run_id: int,
    connection_id: UUID,
    *,
    cursor_after: dict | None,
    discovered_count: int,
    enqueued_count: int,
    poll_interval_seconds: int,
) -> None:
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE workers.watcher_runs
            SET status = 'succeeded',
                cursor_after = $2::jsonb,
                discovered_count = $3,
                enqueued_count = $4
            WHERE id = $1
            """,
            run_id,
            json.dumps(cursor_after) if cursor_after is not None else None,
            discovered_count,
            enqueued_count,
        )
        await conn.execute(
            """
            UPDATE workers.watchers
            SET cursor = $2::jsonb,
                last_polled_at = now(),
                next_poll_at = now() + ($3 || ' seconds')::interval,
                failure_count = 0,
                last_error = NULL
            WHERE id = $1
            """,
            connection_id,
            json.dumps(cursor_after) if cursor_after is not None else None,
            poll_interval_seconds,
        )


async def fail_watch_run(
    conn: asyncpg.Connection,
    run_id: int,
    connection_id: UUID,
    *,
    error_type: str,
    error_message: str,
) -> None:
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE workers.watcher_runs
            SET status = 'failed',
                error_type = $2,
                error_message = $3
            WHERE id = $1
            """,
            run_id,
            error_type,
            error_message,
        )
        await conn.execute(
            """
            UPDATE workers.watchers
            SET failure_count = failure_count + 1,
                last_error = $2,
                next_poll_at = now()
                    + (interval '60 seconds' * POWER(2, LEAST(failure_count, 5)))
            WHERE id = $1
            """,
            connection_id,
            error_message,
        )

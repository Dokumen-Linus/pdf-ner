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
        SELECT sc.id
        FROM workers.source_connections sc
        LEFT JOIN workers.source_sync_states ss ON ss.source_connection_id = sc.id
        WHERE sc.watch_mode = 'polling'
          AND sc.status = 'active'
          AND COALESCE(ss.next_poll_at, sc.next_poll_at, now()) <= now()
        ORDER BY COALESCE(ss.next_poll_at, sc.next_poll_at, sc.created_at)
        LIMIT $1
        """,
        limit,
    )
    return [row["id"] for row in rows]


async def fetch_connection(conn: asyncpg.Connection, connection_id: UUID) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT id, project_id, optimized_prompt_id, provider, display_name, config,
               poll_interval_seconds
        FROM workers.source_connections
        WHERE id = $1
        """,
        connection_id,
    )
    return _connection_payload(row) if row is not None else None


async def fetch_cursor(conn: asyncpg.Connection, connection_id: UUID) -> dict | None:
    row = await conn.fetchrow(
        "SELECT cursor FROM workers.source_sync_states WHERE source_connection_id = $1",
        connection_id,
    )
    return _decode_jsonb(row["cursor"]) if row else None


async def insert_watch_run(
    conn: asyncpg.Connection,
    connection_id: UUID,
    cursor_before: dict | None,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO workers.watch_runs (source_connection_id, status, cursor_before)
        VALUES ($1, 'running', $2::jsonb)
        RETURNING id
        """,
        connection_id,
        json.dumps(cursor_before) if cursor_before is not None else None,
    )


async def complete_watch_run(
    conn: asyncpg.Connection,
    run_id: UUID,
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
            UPDATE workers.watch_runs
            SET status = 'succeeded',
                cursor_after = $2::jsonb,
                discovered_count = $3,
                enqueued_count = $4,
                finished_at = now()
            WHERE id = $1
            """,
            run_id,
            json.dumps(cursor_after) if cursor_after is not None else None,
            discovered_count,
            enqueued_count,
        )
        await conn.execute(
            """
            INSERT INTO workers.source_sync_states
                (source_connection_id, cursor, last_polled_at, next_poll_at, failure_count, last_error)
            VALUES ($1, $2::jsonb, now(), now() + ($3 || ' seconds')::interval, 0, NULL)
            ON CONFLICT (source_connection_id) DO UPDATE
            SET cursor = EXCLUDED.cursor,
                last_polled_at = EXCLUDED.last_polled_at,
                next_poll_at = EXCLUDED.next_poll_at,
                failure_count = 0,
                last_error = NULL,
                updated_at = now()
            """,
            connection_id,
            json.dumps(cursor_after) if cursor_after is not None else None,
            poll_interval_seconds,
        )


async def fail_watch_run(
    conn: asyncpg.Connection,
    run_id: UUID,
    connection_id: UUID,
    *,
    error_type: str,
    error_message: str,
) -> None:
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE workers.watch_runs
            SET status = 'failed',
                error_type = $2,
                error_message = $3,
                finished_at = now()
            WHERE id = $1
            """,
            run_id,
            error_type,
            error_message,
        )
        await conn.execute(
            """
            INSERT INTO workers.source_sync_states
                (source_connection_id, failure_count, last_error, next_poll_at, updated_at)
            VALUES ($1, 1, $2, now() + interval '60 seconds', now())
            ON CONFLICT (source_connection_id) DO UPDATE
            SET failure_count = workers.source_sync_states.failure_count + 1,
                last_error = EXCLUDED.last_error,
                next_poll_at = now() + (
                    LEAST(
                        3600,
                        60 * POWER(2, LEAST(workers.source_sync_states.failure_count, 5))
                    ) || ' seconds'
                )::interval,
                updated_at = now()
            """,
            connection_id,
            error_message,
        )

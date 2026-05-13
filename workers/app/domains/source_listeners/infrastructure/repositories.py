from __future__ import annotations

import json
from typing import Any, cast
from uuid import UUID

import asyncpg

from ..application.schemas import ListenerProvisioningPayload


def _decode_jsonb(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value


def _row_payload(row: asyncpg.Record, *jsonb_fields: str) -> dict:
    payload = dict(row)
    for field in jsonb_fields:
        payload[field] = _decode_jsonb(payload.get(field)) or {}
    return payload


async def fetch_connection(conn: asyncpg.Connection, connection_id: UUID) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT
            l.id,
            nw.project_id,
            pr.active_prompt_id,
            sc.id AS source_connection_id,
            sc.provider,
            sp.provider AS display_name,
            sc.config
        FROM workers.listeners l
        JOIN core.sources s ON s.id = l.pdf_source_id
        JOIN core.source_connections sc ON sc.id = s.source_connection_id
        JOIN public.source_providers sp ON sp.id = sc.provider
        JOIN workers.ner_workflows nw ON nw.listener_id = l.id
        JOIN web.projects pr ON pr.id = nw.project_id
        WHERE l.id = $1
        """,
        connection_id,
    )
    return _row_payload(row, "config") if row is not None else None


async def fetch_subscription(
    conn: asyncpg.Connection,
    subscription_id: UUID,
) -> dict | None:
    row = await conn.fetchrow(
        """
        SELECT l.*, pr.active_prompt_id
        FROM workers.listeners l
        JOIN workers.ner_workflows nw ON nw.listener_id = l.id
        JOIN web.projects pr ON pr.id = nw.project_id
        WHERE l.id = $1
        """,
        subscription_id,
    )
    return _row_payload(row, "provider_payload") if row is not None else None


async def activate_listener(
    conn: asyncpg.Connection,
    connection_id: UUID,
    provider: str,
    payload: ListenerProvisioningPayload,
) -> UUID:
    return cast(
        UUID,
        await conn.fetchval(
            """
        UPDATE workers.listeners
        SET provider = $2,
            provider_subscription_id = $3,
            callback_url = $4,
            secret_ref = $5,
            expires_at = $6,
            renew_after = $7,
            provider_payload = $8::jsonb,
            status = 'active',
            last_error = NULL
        WHERE id = $1
        RETURNING id
        """,
            connection_id,
            provider,
            payload.provider_subscription_id,
            payload.callback_url,
            payload.secret_ref,
            payload.expires_at,
            payload.renew_after,
            json.dumps(payload.provider_payload),
        ),
    )


async def update_subscription(
    conn: asyncpg.Connection,
    subscription_id: UUID,
    payload: ListenerProvisioningPayload,
) -> None:
    await conn.execute(
        """
        UPDATE workers.listeners
        SET status = 'active',
            provider_subscription_id = COALESCE($2, provider_subscription_id),
            callback_url = COALESCE($3, callback_url),
            secret_ref = COALESCE($4, secret_ref),
            expires_at = $5,
            renew_after = $6,
            provider_payload = $7::jsonb,
            last_error = NULL
        WHERE id = $1
        """,
        subscription_id,
        payload.provider_subscription_id,
        payload.callback_url,
        payload.secret_ref,
        payload.expires_at,
        payload.renew_after,
        json.dumps(payload.provider_payload),
    )


async def disable_subscription(conn: asyncpg.Connection, subscription_id: UUID) -> None:
    await conn.execute(
        "UPDATE workers.listeners SET status = 'disabled' WHERE id = $1",
        subscription_id,
    )


async def mark_subscription_error(
    conn: asyncpg.Connection,
    subscription_id: UUID,
    error_message: str,
) -> None:
    await conn.execute(
        """
        UPDATE workers.listeners
        SET status = 'error', last_error = $2
        WHERE id = $1
        """,
        subscription_id,
        error_message,
    )

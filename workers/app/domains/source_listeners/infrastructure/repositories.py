from __future__ import annotations

import json
from typing import Any
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
        SELECT id, project_id, optimized_prompt_id, provider, display_name, config
        FROM workers.source_connections
        WHERE id = $1
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
        SELECT ls.*, sc.optimized_prompt_id
        FROM workers.listener_subscriptions ls
        JOIN workers.source_connections sc ON sc.id = ls.source_connection_id
        WHERE ls.id = $1
        """,
        subscription_id,
    )
    return _row_payload(row, "provider_payload") if row is not None else None


async def insert_subscription(
    conn: asyncpg.Connection,
    connection_id: UUID,
    provider: str,
    payload: ListenerProvisioningPayload,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO workers.listener_subscriptions
            (source_connection_id, provider, provider_subscription_id, callback_url, secret_ref,
             expires_at, renew_after, provider_payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
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
    )


async def update_subscription(
    conn: asyncpg.Connection,
    subscription_id: UUID,
    payload: ListenerProvisioningPayload,
) -> None:
    await conn.execute(
        """
        UPDATE workers.listener_subscriptions
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
        "UPDATE workers.listener_subscriptions SET status = 'disabled' WHERE id = $1",
        subscription_id,
    )


async def mark_subscription_error(
    conn: asyncpg.Connection,
    subscription_id: UUID,
    error_message: str,
) -> None:
    await conn.execute(
        """
        UPDATE workers.listener_subscriptions
        SET status = 'error', last_error = $2
        WHERE id = $1
        """,
        subscription_id,
        error_message,
    )

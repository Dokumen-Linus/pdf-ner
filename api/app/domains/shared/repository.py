from decimal import Decimal
import json
import logging
from uuid import UUID

import asyncpg

from .schemas import MonitoringEventInput

logger = logging.getLogger(__name__)


async def fetch_model_cost(
    conn: asyncpg.Connection,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> Decimal:
    """Look up model pricing from public.chat_models and compute cost in USD.

    Falls back to 0 with a warning if the model is not in the table or has ended.
    """
    row = await conn.fetchrow(
        """
        SELECT usd_per_1m_input, usd_per_1m_output
        FROM public.chat_models
        WHERE id = $1
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model,
    )
    if not row:
        logger.warning("Model not found in public.chat_models: %s — cost recorded as 0", model)
        return Decimal("0")

    cost = (
        input_tokens * float(row["usd_per_1m_input"])
        + output_tokens * float(row["usd_per_1m_output"])
    ) / 1_000_000
    return Decimal(str(round(cost, 8)))


async def fetch_bucket_by_id(conn: asyncpg.Connection, bucket_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT id, name, region, endpoint_url FROM api.aws_buckets WHERE id = $1",
        bucket_id,
    )


async def insert_monitoring_event(
    conn: asyncpg.Connection,
    event: MonitoringEventInput,
) -> None:
    await conn.execute(
        """
        INSERT INTO api.monitoring_events (
            event_name, event_kind, operation_type, source, status, severity,
            actor_user_id, organization_id, project_id, resource_type, resource_id,
            task_id, task_name, request_id, trace_id, route_or_path, method, duration_ms,
            metadata, error_type, error_message, error_stack, raw_error_payload
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17, $18,
            $19::jsonb, $20, $21, $22, $23::jsonb
        )
        """,
        event.event_name,
        event.event_kind,
        event.operation_type,
        event.source,
        event.status,
        event.severity or ("error" if event.status == "failure" else "info"),
        event.actor_user_id,
        event.organization_id,
        event.project_id,
        event.resource_type,
        event.resource_id,
        event.task_id,
        event.task_name,
        event.request_id,
        event.trace_id,
        event.route_or_path,
        event.method,
        event.duration_ms,
        json.dumps(event.metadata),
        event.error_type,
        event.error_message,
        event.error_stack,
        json.dumps(event.raw_error_payload) if event.raw_error_payload is not None else None,
    )


async def delete_old_monitoring_events(conn: asyncpg.Connection, cutoff_sql_interval: str) -> None:
    await conn.execute(
        "DELETE FROM api.monitoring_events WHERE created_at < now() - ($1::text)::interval",
        cutoff_sql_interval,
    )

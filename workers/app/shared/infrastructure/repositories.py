import json

import asyncpg

from app.shared.domain.events import MonitoringEvent


class AsyncpgMonitoringEventRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def add(self, event: MonitoringEvent) -> None:
        await self._conn.execute(
            """
            INSERT INTO workers.monitoring_events (
                id, created_at, event_name, event_kind, operation_type, source, status, severity,
                actor_user_id, organization_id, project_id, resource_type, resource_id,
                task_id, task_name, request_id, trace_id, route_or_path, method, duration_ms,
                metadata, error_type, error_message, error_stack, raw_error_payload
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19, $20,
                $21::jsonb, $22, $23, $24, $25::jsonb
            )
            """,
            event.event_id,
            event.occurred_at,
            event.event_name,
            event.event_kind,
            event.operation_type,
            event.source,
            event.status,
            event.severity,
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

    async def delete_older_than(self, cutoff_sql_interval: str) -> None:
        await self._conn.execute(
            "DELETE FROM workers.monitoring_events WHERE created_at < now() - ($1::text)::interval",
            cutoff_sql_interval,
        )

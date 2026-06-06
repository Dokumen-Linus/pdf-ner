from __future__ import annotations

import json
import logging
import time
import traceback
from typing import Any
from uuid import UUID

from anyio import run as run_async

from app.shared.application.commands import RecordMonitoringEvent
from app.shared.application.handlers import handle_record_monitoring_event
from app.shared.infrastructure.db import get_pool
from app.shared.infrastructure.repositories import AsyncpgMonitoringEventRepository

logger = logging.getLogger(__name__)

MONITORING_RETENTION_DAYS = 180
MONITORING_RETENTION_SWEEP_INTERVAL_SECONDS = 60 * 60

_last_retention_sweep_at = time.monotonic()


def publish_monitoring_event_sync(**kwargs: Any) -> None:
    run_async(_publish_monitoring_event_from_kwargs, kwargs)


async def publish_monitoring_event(**kwargs: Any) -> None:
    cmd = RecordMonitoringEvent(**kwargs)
    _emit_log(cmd)
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            repo = AsyncpgMonitoringEventRepository(conn)
            await _maybe_enforce_retention(repo)
            await handle_record_monitoring_event(cmd, repo)
    except Exception:
        logger.exception("Failed to persist workers monitoring event")


async def _publish_monitoring_event_from_kwargs(kwargs: dict[str, Any]) -> None:
    await publish_monitoring_event(**kwargs)


def publish_task_lifecycle_event_sync(
    *,
    status: str,
    task: Any,
    task_name: str,
    project_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    error: BaseException | None = None,
    started_at: float | None = None,
) -> None:
    fields = _error_fields(error) if error is not None else {}
    publish_monitoring_event_sync(
        event_name=f"workers.task.{status}",
        event_kind="task_lifecycle",
        operation_type="mutation",
        source=task_name,
        status=status,
        project_id=project_id,
        resource_type=resource_type,
        resource_id=resource_id,
        task_id=getattr(getattr(task, "request", None), "id", None),
        task_name=task_name,
        duration_ms=_elapsed_ms(started_at),
        metadata={
            **(metadata or {}),
            "retry_count": getattr(getattr(task, "request", None), "retries", None),
            "max_retries": getattr(task, "max_retries", None),
        },
        raw_error_payload=metadata if error is not None else None,
        **fields,
    )


async def publish_source_integration_event(
    *,
    event_name: str,
    status: str,
    source: str,
    project_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    task_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    error: BaseException | None = None,
    started_at: float | None = None,
) -> None:
    fields = _error_fields(error) if error is not None else {}
    await publish_monitoring_event(
        event_name=event_name,
        event_kind="source_integration",
        operation_type="mutation",
        source=source,
        status=status,
        project_id=project_id,
        resource_type=resource_type,
        resource_id=resource_id,
        task_id=task_id,
        duration_ms=_elapsed_ms(started_at),
        metadata=metadata or {},
        raw_error_payload=metadata if error is not None else None,
        **fields,
    )


async def _maybe_enforce_retention(repo: AsyncpgMonitoringEventRepository) -> None:
    global _last_retention_sweep_at
    now = time.monotonic()
    if now - _last_retention_sweep_at < MONITORING_RETENTION_SWEEP_INTERVAL_SECONDS:
        return
    _last_retention_sweep_at = now
    await repo.delete_older_than(f"{MONITORING_RETENTION_DAYS} days")


def _emit_log(cmd: RecordMonitoringEvent) -> None:
    log_line = json.dumps(
        {
            "service": "dokumen-workers",
            "event_name": cmd.event_name,
            "event_kind": cmd.event_kind,
            "operation_type": cmd.operation_type,
            "status": cmd.status,
            "severity": cmd.severity,
            "project_id": str(cmd.project_id) if cmd.project_id else None,
            "task_id": cmd.task_id,
            "duration_ms": cmd.duration_ms,
            "error_type": cmd.error_type,
            "error_message": cmd.error_message,
        }
    )
    if cmd.status in {"failed", "failure"}:
        logger.error(log_line)
    else:
        logger.info(log_line)


def _error_fields(error: BaseException) -> dict[str, str]:
    return {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "error_stack": "".join(traceback.format_exception(error)),
    }


def _elapsed_ms(started_at: float | None) -> int | None:
    if started_at is None:
        return None
    return max(0, round((time.perf_counter() - started_at) * 1000))

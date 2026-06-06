from __future__ import annotations

from collections.abc import Mapping
import json
import logging
import time
import traceback
from typing import Any

import asyncpg
from fastapi import Request

from .repository import delete_old_monitoring_events, insert_monitoring_event
from .schemas import MonitoringEventInput

logger = logging.getLogger(__name__)

MONITORING_RETENTION_DAYS = 180
MONITORING_RETENTION_SWEEP_INTERVAL_SECONDS = 60 * 60

_last_retention_sweep_at = time.monotonic()
_SENSITIVE_PARTS = (
    "authorization",
    "cookie",
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "client_secret",
    "stripe_secret",
    "session",
)


def monotonic_ms(started_at: float) -> int:
    return max(0, round((time.perf_counter() - started_at) * 1000))


def request_context(request: Request | None) -> dict[str, str | None]:
    if request is None:
        return {"request_id": None, "trace_id": None, "route_or_path": None, "method": None}

    return {
        "request_id": request.headers.get("x-request-id")
        or request.headers.get("x-amzn-trace-id")
        or request.headers.get("cf-ray"),
        "trace_id": request.headers.get("traceparent") or request.headers.get("x-amzn-trace-id"),
        "route_or_path": request.url.path,
        "method": request.method,
    }


def error_fields(error: BaseException) -> dict[str, str]:
    return {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "error_stack": "".join(traceback.format_exception(error)),
    }


async def record_monitoring_event(
    conn: asyncpg.Connection,
    event: MonitoringEventInput,
) -> None:
    sanitized = MonitoringEventInput(
        **{
            **event.__dict__,
            "severity": event.severity or ("error" if event.status == "failure" else "info"),
            "metadata": sanitize_record(event.metadata),
            "raw_error_payload": sanitize_record(event.raw_error_payload or {})
            if event.raw_error_payload is not None
            else None,
        }
    )
    _emit_log(sanitized)

    try:
        await _maybe_enforce_retention(conn)
        await insert_monitoring_event(conn, sanitized)
    except Exception:
        logger.exception("Failed to persist API monitoring event")


def sanitize_record(record: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: _sanitize_value(value) for key, value in record.items() if not _is_sensitive_key(key)
    }


def safe_upload_metadata(request: Request, *, filename: str | None = None) -> dict[str, Any]:
    content_length = request.headers.get("content-length")
    return sanitize_record(
        {
            "content_type": request.headers.get("content-type"),
            "content_length": int(content_length)
            if content_length and content_length.isdigit()
            else None,
            "filename": filename or request.headers.get("x-filename"),
        }
    )


async def _maybe_enforce_retention(conn: asyncpg.Connection) -> None:
    global _last_retention_sweep_at
    now = time.monotonic()
    if now - _last_retention_sweep_at < MONITORING_RETENTION_SWEEP_INTERVAL_SECONDS:
        return
    _last_retention_sweep_at = now
    await delete_old_monitoring_events(conn, f"{MONITORING_RETENTION_DAYS} days")


def _emit_log(event: MonitoringEventInput) -> None:
    log_line = json.dumps(
        {
            "service": "dokumen-api",
            "event_name": event.event_name,
            "event_kind": event.event_kind,
            "operation_type": event.operation_type,
            "status": event.status,
            "severity": event.severity,
            "project_id": str(event.project_id) if event.project_id else None,
            "task_id": event.task_id,
            "request_id": event.request_id,
            "duration_ms": event.duration_ms,
            "error_type": event.error_type,
            "error_message": event.error_message,
        }
    )
    if event.status == "failure":
        logger.error(log_line)
    else:
        logger.info(log_line)


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(part in normalized for part in _SENSITIVE_PARTS)


def _sanitize_value(value: Any, depth: int = 0) -> Any:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if depth >= 5:
        return "[MaxDepth]"
    if isinstance(value, bytes | bytearray | memoryview):
        return "[BinaryPayloadOmitted]"
    if isinstance(value, list | tuple):
        return [_sanitize_value(item, depth + 1) for item in value]
    if isinstance(value, Mapping):
        return {
            key: _sanitize_value(nested, depth + 1)
            for key, nested in value.items()
            if not _is_sensitive_key(str(key))
        }
    return str(value)

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .events import MonitoringEvent
from .value_objects import severity_for_status

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


def build_monitoring_event(**kwargs: Any) -> MonitoringEvent:
    status = kwargs["status"]
    kwargs["severity"] = kwargs.get("severity") or severity_for_status(status)
    kwargs["metadata"] = sanitize_record(kwargs.get("metadata") or {})
    if kwargs.get("raw_error_payload") is not None:
        kwargs["raw_error_payload"] = sanitize_record(kwargs["raw_error_payload"])
    return MonitoringEvent.new(**kwargs)


def sanitize_record(record: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: _sanitize_value(value)
        for key, value in record.items()
        if not _is_sensitive_key(str(key))
    }


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
            str(key): _sanitize_value(nested, depth + 1)
            for key, nested in value.items()
            if not _is_sensitive_key(str(key))
        }
    return str(value)

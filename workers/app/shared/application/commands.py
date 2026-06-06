from dataclasses import dataclass
from typing import Any
from uuid import UUID


@dataclass(frozen=True)
class RecordMonitoringEvent:
    event_name: str
    event_kind: str
    operation_type: str
    source: str
    status: str
    severity: str | None = None
    actor_user_id: str | None = None
    organization_id: str | None = None
    project_id: UUID | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    task_id: str | None = None
    task_name: str | None = None
    request_id: str | None = None
    trace_id: str | None = None
    route_or_path: str | None = None
    method: str | None = None
    duration_ms: int | None = None
    metadata: dict[str, Any] | None = None
    error_type: str | None = None
    error_message: str | None = None
    error_stack: str | None = None
    raw_error_payload: dict[str, Any] | None = None

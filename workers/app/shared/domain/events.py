from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from .value_objects import (
    MonitoringEventKind,
    MonitoringOperationType,
    MonitoringSeverity,
    MonitoringStatus,
    validate_event_name,
)


@dataclass(frozen=True)
class MonitoringEvent:
    event_id: UUID
    occurred_at: datetime
    event_name: str
    event_kind: MonitoringEventKind
    operation_type: MonitoringOperationType
    source: str
    status: MonitoringStatus
    severity: MonitoringSeverity
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
    metadata: dict[str, Any] = field(default_factory=dict)
    error_type: str | None = None
    error_message: str | None = None
    error_stack: str | None = None
    raw_error_payload: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        validate_event_name(self.event_name)

    @staticmethod
    def new(**kwargs: Any) -> MonitoringEvent:
        return MonitoringEvent(
            event_id=uuid4(),
            occurred_at=datetime.now(tz=UTC),
            **kwargs,
        )

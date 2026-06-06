from typing import Literal

MonitoringEventKind = Literal["task_lifecycle", "source_integration"]
MonitoringOperationType = Literal["read", "mutation"]
MonitoringSeverity = Literal["info", "error"]
MonitoringStatus = Literal[
    "started",
    "succeeded",
    "success",
    "failed",
    "failure",
    "retrying",
    "skipped",
]


def severity_for_status(status: MonitoringStatus) -> MonitoringSeverity:
    return "error" if status in {"failed", "failure"} else "info"


def validate_event_name(event_name: str) -> str:
    if not event_name.strip():
        raise ValueError("event_name is required")
    return event_name

from app.shared.domain.repositories import MonitoringEventRepository
from app.shared.domain.services import build_monitoring_event

from .commands import RecordMonitoringEvent


async def handle_record_monitoring_event(
    cmd: RecordMonitoringEvent,
    repository: MonitoringEventRepository,
) -> None:
    event = build_monitoring_event(**cmd.__dict__)
    await repository.add(event)

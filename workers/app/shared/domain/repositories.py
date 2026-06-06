from typing import Protocol

from .events import MonitoringEvent


class MonitoringEventRepository(Protocol):
    async def add(self, event: MonitoringEvent) -> None: ...
    async def delete_older_than(self, cutoff_sql_interval: str) -> None: ...

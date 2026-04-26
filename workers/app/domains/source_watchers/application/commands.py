from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class DispatchDueWatchers:
    limit: int = 100


@dataclass(frozen=True)
class PollSourceConnection:
    connection_id: UUID


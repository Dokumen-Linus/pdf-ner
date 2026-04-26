from dataclasses import dataclass
from uuid import UUID

from app.shared.domain.DomainEvent import DomainEvent


@dataclass(frozen=True)
class ChangesDiscovered(DomainEvent):
    source_connection_id: UUID
    discovered_count: int
    enqueued_count: int

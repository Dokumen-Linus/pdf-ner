from dataclasses import dataclass
from uuid import UUID

from app.shared.domain.DomainEvent import DomainEvent


@dataclass(frozen=True)
class ListenerCreated(DomainEvent):
    source_connection_id: UUID
    listener_subscription_id: UUID


@dataclass(frozen=True)
class ListenerRenewed(DomainEvent):
    listener_subscription_id: UUID


@dataclass(frozen=True)
class ListenerDisabled(DomainEvent):
    listener_subscription_id: UUID


from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class CreateListener:
    connection_id: UUID


@dataclass(frozen=True)
class RenewListener:
    listener_subscription_id: UUID


@dataclass(frozen=True)
class DisableListener:
    listener_subscription_id: UUID


@dataclass(frozen=True)
class HandleListenerEvent:
    listener_subscription_id: UUID
    event_payload: dict

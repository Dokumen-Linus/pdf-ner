from __future__ import annotations

from typing import Protocol

from ..application.schemas import ListenerEventPayload, ListenerProvisioningPayload


class SourceListener(Protocol):
    async def create(self, connection: dict) -> ListenerProvisioningPayload: ...

    async def renew(self, subscription: dict) -> ListenerProvisioningPayload: ...

    async def disable(self, subscription: dict) -> None: ...

    async def normalize_event(
        self, subscription: dict, event_payload: dict
    ) -> ListenerEventPayload: ...


class ListenerRegistry:
    def __init__(self) -> None:
        self._listeners: dict[str, SourceListener] = {}

    def register(self, provider: str, listener: SourceListener) -> None:
        self._listeners[provider] = listener

    def resolve(self, provider: str) -> SourceListener:
        try:
            return self._listeners[provider]
        except KeyError as exc:
            raise LookupError(f"No source listener registered for provider '{provider}'") from exc

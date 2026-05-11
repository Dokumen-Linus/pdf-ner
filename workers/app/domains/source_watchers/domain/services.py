from __future__ import annotations

from typing import Protocol
from uuid import UUID

from ..application.schemas import WatchDiscoveryResult


class SourceWatcher(Protocol):
    async def discover(self, connection: dict, cursor: dict | None) -> WatchDiscoveryResult: ...


class WatcherRegistry:
    def __init__(self) -> None:
        self._watchers: dict[str, SourceWatcher] = {}

    def register(self, provider: str, watcher: SourceWatcher) -> None:
        self._watchers[provider] = watcher

    def resolve(self, provider: str) -> SourceWatcher:
        try:
            return self._watchers[provider]
        except KeyError as exc:
            raise LookupError(f"No source watcher registered for provider '{provider}'") from exc


def extraction_task_args(source_id: UUID, *_deprecated_args: UUID) -> tuple[str]:
    return (str(source_id),)

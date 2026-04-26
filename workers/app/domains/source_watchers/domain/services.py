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


def extraction_task_args(document_source_id: UUID, optimized_prompt_id: UUID) -> tuple[str, str]:
    return str(document_source_id), str(optimized_prompt_id)

from typing import Protocol
from uuid import UUID


class WatcherRepository(Protocol):
    async def fetch_due_connection_ids(self, limit: int) -> list[UUID]: ...

    async def fetch_connection(self, connection_id: UUID): ...

    async def fetch_cursor(self, connection_id: UUID) -> dict | None: ...

    async def insert_watch_run(self, connection_id: UUID, cursor_before: dict | None) -> UUID: ...

    async def complete_watch_run(
        self,
        run_id: UUID,
        *,
        cursor_after: dict | None,
        discovered_count: int,
        enqueued_count: int,
    ) -> None: ...

    async def fail_watch_run(self, run_id: UUID, error_type: str, error_message: str) -> None: ...


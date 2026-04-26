from typing import Protocol
from uuid import UUID


class ListenerRepository(Protocol):
    async def fetch_connection(self, connection_id: UUID): ...

    async def fetch_subscription(self, subscription_id: UUID): ...


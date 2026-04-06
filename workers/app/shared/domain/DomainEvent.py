from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4


@dataclass(frozen=True)
class DomainEvent:
    """
    Base type for all events.
    """

    event_id: UUID
    occurred_at: datetime

    @staticmethod
    def new() -> dict[str, Any]:
        return {
            "event_id": uuid4(),
            "occurred_at": datetime.now(tz=UTC),
        }

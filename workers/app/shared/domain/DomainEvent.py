from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import UUID, uuid4


@dataclass(frozen=True)
class DomainEvent:
    """
    Base type for all events.
    """

    event_id: UUID
    occurred_at: datetime

    @staticmethod
    def new() -> Dict[str, Any]:
        return {
            "event_id": uuid4(),
            "occurred_at": datetime.now(tz=timezone.utc),
        }

import time
from datetime import datetime, timezone
from typing import Protocol
import anyio


# type
class Clock(Protocol):
    def now(self) -> datetime: ...
    async def sleep(self, seconds: float) -> None: ...
    def deadline(self, timeout_seconds: float) -> float: ...


# prod implementation
class SystemClock:
    def now(self) -> datetime:
        return datetime.now(tz=timezone.utc)

    async def sleep(self, seconds: float) -> None:
        await anyio.sleep(seconds)

    def deadline(self, timeout_seconds: float) -> float:
        return time.monotonic() + timeout_seconds


# deterministic clock for testing
class FrozenClock:
    def __init__(self, instant: datetime):
        if instant.tzinfo is None:
            raise ValueError("FrozenClock requires a timezone-aware datetime")
        self._instant = instant
        self._monotonic_base = 0.0

    def now(self) -> datetime:
        return self._instant

    async def sleep(self, seconds: float) -> None:
        # no-op, but advance monotonic time deterministically
        self._monotonic_base += seconds

    def deadline(self, timeout_seconds: float) -> float:
        return self._monotonic_base + timeout_seconds

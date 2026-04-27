from datetime import UTC, datetime

import pytest

from app.shared.infrastructure.time import FrozenClock, SystemClock


class TestSystemClock:
    def test_now_returns_utc(self):
        clock = SystemClock()
        now = clock.now()
        assert now.tzinfo == UTC

    def test_now_is_recent(self):
        clock = SystemClock()
        now = clock.now()
        assert (datetime.now(tz=UTC) - now).total_seconds() < 1

    @pytest.mark.anyio
    async def test_sleep(self):
        clock = SystemClock()
        await clock.sleep(0.01)  # minimal sleep

    def test_deadline(self):
        clock = SystemClock()
        d = clock.deadline(10.0)
        assert d > 0


class TestFrozenClock:
    def test_now_returns_fixed_time(self, frozen_now):
        clock = FrozenClock(frozen_now)
        assert clock.now() == frozen_now
        assert clock.now() == frozen_now  # still the same

    def test_requires_timezone(self):
        with pytest.raises(ValueError, match="timezone-aware"):
            FrozenClock(datetime(2026, 1, 1))

    @pytest.mark.anyio
    async def test_sleep_advances_monotonic(self, frozen_now):
        clock = FrozenClock(frozen_now)
        d1 = clock.deadline(0)
        assert d1 == 0.0

        await clock.sleep(5.0)
        d2 = clock.deadline(0)
        assert d2 == 5.0

    @pytest.mark.anyio
    async def test_sleep_does_not_change_now(self, frozen_now):
        clock = FrozenClock(frozen_now)
        await clock.sleep(100.0)
        assert clock.now() == frozen_now

    def test_deadline_adds_timeout(self, frozen_now):
        clock = FrozenClock(frozen_now)
        assert clock.deadline(10.0) == 10.0

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.health import (
    _maybe_await,
    build_readiness_checks,
    check_database,
    check_redis,
    overall_status,
)


class TestCheckRedis:
    @pytest.mark.anyio
    async def test_missing_redis(self):
        assert await check_redis(None) == "missing"

    @pytest.mark.anyio
    async def test_no_ping_method(self):
        redis = object()
        assert await check_redis(redis) == "ready"

    @pytest.mark.anyio
    async def test_ping_success(self):
        redis = MagicMock()
        redis.ping = lambda: True
        assert await check_redis(redis) == "ready"

    @pytest.mark.anyio
    async def test_ping_failure(self):
        redis = MagicMock()
        redis.ping = lambda: False
        assert await check_redis(redis) == "unready"

    @pytest.mark.anyio
    async def test_ping_async_success(self):
        redis = AsyncMock()
        redis.ping = AsyncMock(return_value=True)
        assert await check_redis(redis) == "ready"

    @pytest.mark.anyio
    async def test_ping_raises(self):
        redis = AsyncMock()
        redis.ping = AsyncMock(side_effect=ConnectionError)
        assert await check_redis(redis) == "unready"


class TestCheckDatabase:
    @pytest.mark.anyio
    async def test_missing_pool(self):
        result = await check_database(None)
        assert all(v == "missing" for v in result.values())

    @pytest.mark.anyio
    async def test_pool_exception(self):
        pool = MagicMock()
        pool.acquire = AsyncMock(side_effect=RuntimeError("db down"))
        result = await check_database(pool)
        assert all(v == "unready" for v in result.values())


class TestBuildReadinessChecks:
    @pytest.mark.anyio
    async def test_builds_checks(self):
        async def db_checker(p):
            return {"table:test": "ready"}

        async def r_checker(r):
            return {"redis": "ready"}

        result = await build_readiness_checks(
            pool=None,
            redis=MagicMock(),
            database_checker=db_checker,
            redis_checker=r_checker,
        )
        assert "redis" in result


class TestOverallStatus:
    def test_all_ready(self):
        assert overall_status({"redis": "ready", "db": "ready"}) == "ready"

    def test_any_unready(self):
        assert overall_status({"redis": "ready", "db": "unready"}) == "unready"

    def test_all_unready(self):
        assert overall_status({"redis": "unready"}) == "unready"

    def test_empty_is_ready(self):
        assert overall_status({}) == "ready"


class TestMaybeAwait:
    @pytest.mark.anyio
    async def test_awaits_awaitable(self):
        async def returns_42():
            return 42

        assert await _maybe_await(returns_42()) == 42

    @pytest.mark.anyio
    async def test_returns_non_awaitable(self):
        assert await _maybe_await(42) == 42

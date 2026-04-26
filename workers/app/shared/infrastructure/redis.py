from pathlib import Path
import sys
from types import TracebackType
from uuid import uuid4

from celery import current_app
import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import bind_worker_context

_OBS_PATH = Path(__file__).resolve().parents[4] / "packages" / "otel_py"
if str(_OBS_PATH) not in sys.path:
    sys.path.insert(0, str(_OBS_PATH))

from otel_py import observe_redis_operation  # noqa: E402


def _redis_key_prefix(key: str) -> str:
    prefix, _, _ = key.partition(":")
    return prefix or key


async def get_redis() -> redis.Redis:
    """Get the Redis client from Celery app state."""
    if not hasattr(current_app, "_redis_client") or current_app._redis_client is None:
        current_app._redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            retry_on_timeout=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
    return current_app._redis_client


async def close_redis() -> None:
    """Close the Redis client."""
    if hasattr(current_app, "_redis_client") and current_app._redis_client is not None:
        await current_app._redis_client.aclose()
        current_app._redis_client = None


async def set_cache(key: str, value: str, ttl: int = 3600) -> None:
    """Set a value in Redis cache with TTL."""
    client = await get_redis()
    bind_worker_context(redis_key=key)
    with observe_redis_operation("setex", key_prefix=_redis_key_prefix(key)):
        await client.setex(key, ttl, value)


async def get_cache(key: str) -> str | None:
    """Get a value from Redis cache."""
    client = await get_redis()
    bind_worker_context(redis_key=key)
    with observe_redis_operation("get", key_prefix=_redis_key_prefix(key)):
        return await client.get(key)


async def delete_cache(key: str) -> bool:
    """Delete a key from Redis cache."""
    client = await get_redis()
    bind_worker_context(redis_key=key)
    with observe_redis_operation("delete", key_prefix=_redis_key_prefix(key)):
        result = await client.delete(key)
    return result > 0


class RedisLock:
    """Small Redis SET NX lock with ownership-safe release."""

    def __init__(self, key: str, ttl: int = 900) -> None:
        self.key = key
        self.ttl = ttl
        self.token = str(uuid4())
        self.acquired = False

    async def __aenter__(self) -> "RedisLock":
        client = await get_redis()
        bind_worker_context(redis_key=self.key)
        with observe_redis_operation("set", key_prefix=_redis_key_prefix(self.key)):
            self.acquired = bool(await client.set(self.key, self.token, nx=True, ex=self.ttl))
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        if not self.acquired:
            return
        client = await get_redis()
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        end
        return 0
        """
        bind_worker_context(redis_key=self.key)
        with observe_redis_operation("eval", key_prefix=_redis_key_prefix(self.key)):
            await client.eval(script, 1, self.key, self.token)


async def set_job_status(job_id: str, status: str, ttl: int = 86400) -> None:
    """Set job status in Redis with 24h TTL."""
    await set_cache(f"job:{job_id}:status", status, ttl)


async def get_job_status(job_id: str) -> str | None:
    """Get job status from Redis."""
    return await get_cache(f"job:{job_id}:status")

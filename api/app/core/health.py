from collections.abc import Awaitable, Callable

import asyncpg

API_TABLES = (
    "api.aws_buckets",
    "api.pdfs",
    "api.prompts",
)


async def _maybe_await(value: object) -> object:
    if hasattr(value, "__await__"):
        return await value  # type: ignore[misc]
    return value


async def check_redis(redis: object | None) -> str:
    if redis is None:
        return "missing"

    ping = getattr(redis, "ping", None)
    if not callable(ping):
        return "ready"

    try:
        result = await _maybe_await(ping())
    except Exception:
        return "unready"

    return "ready" if result else "unready"


async def check_database(pool: asyncpg.Pool | None) -> dict[str, str]:
    checks = {f"table:{table}": "unknown" for table in API_TABLES}
    checks["privilege:workers.llm_usage:insert"] = "unknown"

    if pool is None:
        return {key: "missing" for key in checks}

    try:
        async with pool.acquire() as conn:
            for table in API_TABLES:
                exists = await conn.fetchval("SELECT to_regclass($1) IS NOT NULL", table)
                checks[f"table:{table}"] = "ready" if exists else "missing"

            can_insert = await conn.fetchval(
                "SELECT has_table_privilege(current_user, $1, 'INSERT')",
                "workers.llm_usage",
            )
            checks["privilege:workers.llm_usage:insert"] = "ready" if can_insert else "missing"
    except Exception:
        return {key: "unready" for key in checks}

    return checks


async def build_readiness_checks(
    *,
    pool: asyncpg.Pool | None,
    redis: object | None,
    database_checker: Callable[[asyncpg.Pool | None], Awaitable[dict[str, str]]] = check_database,
    redis_checker: Callable[[object | None], Awaitable[str]] = check_redis,
) -> dict[str, str]:
    checks: dict[str, str] = {"redis": await redis_checker(redis)}
    checks.update(await database_checker(pool))
    return checks


def overall_status(checks: dict[str, str]) -> str:
    return "ready" if all(value == "ready" for value in checks.values()) else "unready"

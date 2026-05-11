from __future__ import annotations

import argparse
import json
from typing import Any

import anyio
import asyncpg
from celery import Celery
from redis.asyncio import Redis

from app.core.config import settings
from app.main import app as celery_app

WORKER_TABLES = (
    "core.pdfs",
    "workers.pdf_txts",
    "workers.ner_runs",
    "workers.llm_usage",
    "workers.billing_charge_attempts",
    "workers.ocr_evaluation_runs",
)


async def check_redis() -> str:
    client = Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )
    try:
        return "ready" if await client.ping() else "unready"
    except Exception:
        return "unready"
    finally:
        await client.aclose()


def check_celery(app: Celery = celery_app) -> str:
    try:
        inspector = app.control.inspect(timeout=5)
        replies = inspector.ping()
    except Exception:
        return "unready"
    return "ready" if replies else "unready"


async def check_database() -> dict[str, str]:
    checks = {f"table:{table}": "unknown" for table in WORKER_TABLES}
    pool: asyncpg.Pool | None = None
    try:
        pool = await asyncpg.create_pool(
            settings.WORKERS_DATABASE_URL,
            min_size=1,
            max_size=1,
            command_timeout=10,
        )
        async with pool.acquire() as conn:
            for table in WORKER_TABLES:
                exists = await conn.fetchval("SELECT to_regclass($1) IS NOT NULL", table)
                checks[f"table:{table}"] = "ready" if exists else "missing"
    except Exception:
        return {key: "unready" for key in checks}
    finally:
        if pool is not None:
            await pool.close()

    return checks


def overall_status(checks: dict[str, str]) -> str:
    return "ready" if all(value == "ready" for value in checks.values()) else "unready"


async def build_health(*, include_database: bool) -> dict[str, Any]:
    checks: dict[str, str] = {
        "redis": await check_redis(),
        "celery": await anyio.to_thread.run_sync(check_celery),
    }
    if include_database:
        checks.update(await check_database())
    return {"status": overall_status(checks), "checks": checks}


def main() -> int:
    parser = argparse.ArgumentParser(description="Worker health check")
    parser.add_argument("--json", action="store_true", help="Print JSON details")
    parser.add_argument(
        "--container",
        action="store_true",
        help="Run container liveness checks and print only on failure",
    )
    args = parser.parse_args()

    include_database = args.json and not args.container
    result = anyio.run(lambda: build_health(include_database=include_database))
    status = 0 if result["status"] == "ready" else 1

    if args.json:
        print(json.dumps(result, sort_keys=True))
    elif status != 0:
        print(json.dumps(result, sort_keys=True))

    return status


if __name__ == "__main__":
    raise SystemExit(main())

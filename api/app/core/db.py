from collections.abc import AsyncGenerator

import asyncpg
from fastapi import Depends, Request


def get_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.pool


async def get_conn(pool: asyncpg.Pool = Depends(get_pool)) -> AsyncGenerator[asyncpg.Connection]:
    async with pool.acquire() as conn:
        yield conn

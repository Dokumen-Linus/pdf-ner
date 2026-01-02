import asyncpg
from fastapi import Depends
from app.core.config import settings

pool: asyncpg.Pool | None = None


async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(dsn=settings.API_DATABASE_URL, min_size=1, max_size=10)
    return pool


async def get_connection(pool: asyncpg.Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        yield conn

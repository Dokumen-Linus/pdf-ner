import asyncpg
from fastapi import Depends
import os
import dotenv

dotenv.load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
pool: asyncpg.Pool | None = None

async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=1, max_size=10)
    return pool

async def get_connection(pool: asyncpg.Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        yield conn
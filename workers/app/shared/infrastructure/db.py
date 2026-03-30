import asyncpg
from celery import current_app
from app.core.config import settings


async def get_pool() -> asyncpg.Pool:
    """Get the database pool from Celery app state."""
    if not hasattr(current_app, '_db_pool') or current_app._db_pool is None:
        current_app._db_pool = await asyncpg.create_pool(
            settings.WORKERS_DATABASE_URL,
            min_size=1,
            max_size=10,
            command_timeout=60,
        )
    return current_app._db_pool


async def close_pool() -> None:
    """Close the database pool."""
    if hasattr(current_app, '_db_pool') and current_app._db_pool is not None:
        await current_app._db_pool.close()
        current_app._db_pool = None


async def get_connection() -> asyncpg.Connection:
    """Get a database connection from the pool."""
    pool = await get_pool()
    return await pool.acquire()


async def release_connection(connection: asyncpg.Connection) -> None:
    """Release a database connection back to the pool."""
    pool = await get_pool()
    await pool.release(connection)
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import asyncpg
from fastapi import FastAPI
import anyio

from .config import get_settings
from .logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging()

    limiter = anyio.to_thread.current_default_thread_limiter()
    limiter.total_tokens = 50

    app.state.pool = await asyncpg.create_pool(
        dsn=settings.API_DATABASE_URL,
        min_size=1,
        max_size=10,
    )

    try:
        yield
    finally:
        await app.state.pool.close()

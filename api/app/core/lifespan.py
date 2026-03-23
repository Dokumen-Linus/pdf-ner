from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio
import asyncpg
import boto3
from anthropic import AsyncAnthropic
from fastapi import FastAPI
from google import genai
from openai import AsyncOpenAI
from redis.asyncio import Redis

from .config import settings
from .logging import configure_logging

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()

    limiter = anyio.to_thread.current_default_thread_limiter()
    limiter.total_tokens = 50

    app.state.pool = await asyncpg.create_pool(
        dsn=settings.API_DATABASE_URL,
        min_size=1,
        max_size=10,
    )

    app.state.anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    app.state.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    app.state.google_ai_client = genai.Client(api_key=settings.GOOGLE_AI_API_KEY)

    s3_kwargs = {
        "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
        "region_name": settings.AWS_REGION,
    }
    if settings.AWS_ENDPOINT_URL:
        s3_kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL
    app.state.s3 = boto3.client("s3", **s3_kwargs)

    # use app.state.redis for cahing, locks, KV, etc. don't use for messaging. use celery client for messaging
    app.state.redis = Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )
    # celery client is not async so it is not stored in app.state??

    try:
        yield
    finally:
        await app.state.pool.close()
        await app.state.redis.close()

import os

# Must be set before any app module is imported so pydantic-settings can
# validate Settings at import time.  setdefault means a real .env still wins.
_TEST_ENV = {
    "API_DATABASE_URL": "postgres://test:test@localhost/test",
    "REDIS_URL": "redis://localhost/0",
    "API_KEY": "test-api-key",
    "HEALTHCHECK_TOKEN": "test-health-token",
    "CORS_ORIGINS": '["http://localhost:3000"]',
    "ANTHROPIC_API_KEY": "test-anthropic-key",
    "OPENAI_API_KEY": "test-openai-key",
    "GOOGLE_AI_API_KEY": "test-google-key",
    "STRIPE_SECRET_KEY": "sk_test_dummy",
    "AVATARS_S3_BUCKET_NAME": "avatars-test",
}
for _k, _v in _TEST_ENV.items():
    os.environ.setdefault(_k, _v)

from unittest.mock import AsyncMock

from fastapi import APIRouter, Depends, FastAPI
import httpx
import pytest

from app.core.db import get_conn
from app.core.dependencies import verify_api_key
from app.core.exceptions import register_exception_handlers
from app.domains.pdf_utils.router import router as pdf_utils_router
from app.domains.worker_dispatch.router import router as worker_dispatch_router

_TEST_API_KEY: str = os.environ["API_KEY"]


# ---------------------------------------------------------------------------
# Infrastructure mocks (db, redis, s3)
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_conn():
    """Async asyncpg connection mock."""
    return AsyncMock()


@pytest.fixture
def mock_redis():
    """Async Redis client mock."""
    redis = AsyncMock()
    redis.close = AsyncMock()
    return redis


# ---------------------------------------------------------------------------
# FastAPI test client
# ---------------------------------------------------------------------------


@pytest.fixture
async def async_client(
    mock_conn,
    mock_redis,
):
    """httpx.AsyncClient wired to a test FastAPI app.

    All external dependencies (DB, Redis, LLM clients) are replaced with
    mocks so no running services are required.  The API key header is included
    so auth passes on every request.
    """

    app = FastAPI()
    register_exception_handlers(app)

    # Set state directly (lifespan isn't called by httpx.ASGITransport)
    app.state.redis = mock_redis

    # Async-generator override for the DB connection dependency
    async def _get_test_conn():
        yield mock_conn

    app.dependency_overrides[verify_api_key] = lambda: None
    app.dependency_overrides[get_conn] = _get_test_conn

    # Mirror the real /api/v1 prefix and auth guard
    api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(verify_api_key)])
    api_router.include_router(worker_dispatch_router)
    api_router.include_router(pdf_utils_router)
    app.include_router(api_router)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        headers={"X-API-Key": _TEST_API_KEY},
    ) as client:
        yield client

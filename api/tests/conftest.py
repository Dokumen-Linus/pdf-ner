import os

# Must be set before any app module is imported so pydantic-settings can
# validate Settings at import time.  setdefault means a real .env still wins.
_TEST_ENV = {
    "API_DATABASE_URL": "postgres://test:test@localhost/test",
    "REDIS_URL": "redis://localhost/0",
    "API_KEY": "test-api-key",
    "CORS_ORIGINS": '["http://localhost:3000"]',
    "ANTHROPIC_API_KEY": "test-anthropic-key",
    "OPENAI_API_KEY": "test-openai-key",
    "GOOGLE_AI_API_KEY": "test-google-key",
    "STRIPE_SECRET_KEY": "sk_test_dummy",
}
for _k, _v in _TEST_ENV.items():
    os.environ.setdefault(_k, _v)

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

from fastapi import APIRouter, Depends, FastAPI
import httpx
import pytest

from app.core.db import get_conn
from app.core.dependencies import get_llm_clients, verify_api_key
from app.core.exceptions import register_exception_handlers
from app.domains.llm_ner.router import router as llm_ner_router
from app.domains.pdf_utils.router import router as pdf_utils_router

_TEST_API_KEY: str = os.environ["API_KEY"]


# ---------------------------------------------------------------------------
# LLM client mocks
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_anthropic_client():
    client = AsyncMock()
    client.messages.create = AsyncMock(
        return_value=MagicMock(content=[MagicMock(text='{"field1": "value1"}')])
    )
    return client


@pytest.fixture
def mock_openai_client():
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(
        return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content='{"field1": "value1"}'))]
        )
    )
    return client


@pytest.fixture
def mock_google_client():
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(text='{"field1": "value1"}')
    )
    return client


@pytest.fixture
def mock_clients(mock_anthropic_client, mock_openai_client, mock_google_client):
    return {
        "anthropic": mock_anthropic_client,
        "openai": mock_openai_client,
        "gemini": mock_google_client,
    }


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
    mock_anthropic_client,
    mock_openai_client,
    mock_google_client,
    mock_redis,
):
    """httpx.AsyncClient wired to a test FastAPI app.

    All external dependencies (DB, Redis, LLM clients) are replaced with
    mocks so no running services are required.  The API key header is included
    so auth passes on every request.
    """

    @asynccontextmanager
    async def _test_lifespan(application: FastAPI):
        application.state.redis = mock_redis
        yield

    app = FastAPI(lifespan=_test_lifespan)
    register_exception_handlers(app)

    # Async-generator override for the DB connection dependency
    async def _get_test_conn():
        yield mock_conn

    app.dependency_overrides[verify_api_key] = lambda: None
    app.dependency_overrides[get_conn] = _get_test_conn
    app.dependency_overrides[get_llm_clients] = lambda: {
        "anthropic": mock_anthropic_client,
        "openai": mock_openai_client,
        "gemini": mock_google_client,
    }

    # Mirror the real /api/v1 prefix and auth guard
    api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(verify_api_key)])
    api_router.include_router(llm_ner_router)
    api_router.include_router(pdf_utils_router)
    app.include_router(api_router)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        headers={"X-API-Key": _TEST_API_KEY},
    ) as client:
        yield client


# ---------------------------------------------------------------------------
# Sample domain data
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_entity_types():
    """Sample entity type records for testing."""
    return [
        {
            "name": "company_name",
            "page1_definition": "The name of the company",
            "page1_examples": ["Acme Corp", "TechStart Inc"],
            "page1_datatype": "string",
            "unique": True,
            "required": True,
        },
        {
            "name": "invoice_number",
            "page1_definition": "The invoice identifier",
            "page1_examples": ["INV-001", "INV-002"],
            "page1_datatype": "string",
            "unique": True,
            "required": True,
        },
    ]


@pytest.fixture
def sample_template():
    """Sample template record for testing."""
    return {
        "id": 1,
        "txt": """Extract the following fields:
<PROJECT_DESCRIPTION>
Fields: <ENTITY_TYPES>
Definitions: <DEFINITIONS>
Examples: <EXAMPLE_VALUES>
Constraints: <CONSTRAINTS>
Required: <IS_REQUIRED>
Unique: <IS_UNIQUE>
Document:""",
        "inserts": [
            "<PROJECT_DESCRIPTION>",
            "<ENTITY_TYPES>",
            "<DEFINITIONS>",
            "<EXAMPLE_VALUES>",
            "<CONSTRAINTS>",
            "<IS_REQUIRED>",
            "<IS_UNIQUE>",
        ],
        "document_at_end": True,
    }

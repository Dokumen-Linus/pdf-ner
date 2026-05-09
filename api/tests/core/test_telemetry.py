from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
import httpx
import pytest

from app.core.logging import get_metrics_registry, telemetry_router
from app.core.middleware import RequestIDMiddleware, RequestLoggingMiddleware


class AcquireContext:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return None


@pytest.fixture
def telemetry_app():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RequestIDMiddleware)
    app.include_router(telemetry_router)

    @app.get("/ping")
    async def ping():
        return {"ok": True}

    redis = AsyncMock()
    redis.ping = AsyncMock(return_value=True)
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=True)
    pool = MagicMock()
    pool.acquire.return_value = AcquireContext(conn)
    app.state.redis = redis
    app.state.pool = pool
    return app


@pytest.fixture(autouse=True)
def reset_metrics():
    get_metrics_registry().reset()


@pytest.mark.anyio
async def test_request_id_and_metrics_are_exposed(telemetry_app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=telemetry_app),
        base_url="http://test",
    ) as client:
        response = await client.get("/ping")
        assert response.status_code == 200
        assert response.headers["X-Request-ID"]
        assert response.headers["X-Trace-ID"]

        metrics = await client.get("/metrics")
        body = metrics.text
        assert "dokumen_http_requests_total" in body
        assert 'route="/ping"' in body


@pytest.mark.anyio
async def test_metrics_use_route_template_labels(telemetry_app):
    @telemetry_app.get("/items/{item_id}")
    async def get_item(item_id: str):
        return {"item_id": item_id}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=telemetry_app),
        base_url="http://test",
    ) as client:
        response = await client.get("/items/123e4567-e89b-12d3-a456-426614174000")
        assert response.status_code == 200

        metrics = await client.get("/metrics")
        body = metrics.text
        assert 'route="/items/{item_id}"' in body
        assert 'route="/items/123e4567-e89b-12d3-a456-426614174000"' not in body


@pytest.mark.anyio
async def test_readyz_reports_dependencies(telemetry_app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=telemetry_app),
        base_url="http://test",
    ) as client:
        response = await client.get("/readyz")
        assert response.status_code == 200
        assert response.json() == {"status": "ready"}


@pytest.mark.anyio
async def test_readyz_details_requires_token(telemetry_app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=telemetry_app),
        base_url="http://test",
    ) as client:
        assert (await client.get("/readyz/details")).status_code == 401
        assert (
            await client.get("/readyz/details", headers={"X-Health-Check-Token": "wrong"})
        ).status_code == 401


@pytest.mark.anyio
async def test_readyz_details_reports_dependency_checks(telemetry_app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=telemetry_app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/readyz/details",
            headers={"X-Health-Check-Token": "test-health-token"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ready"
        assert body["checks"]["redis"] == "ready"
        assert body["checks"]["table:api.aws_buckets"] == "ready"
        assert body["checks"]["table:api.prompts"] == "ready"
        assert body["checks"]["privilege:workers.llm_usage:insert"] == "ready"


@pytest.mark.anyio
async def test_readyz_schema_probe_failure_returns_503(telemetry_app):
    conn = AsyncMock()
    conn.fetchval = AsyncMock(side_effect=[True, False, True, True])
    pool = MagicMock()
    pool.acquire.return_value = AcquireContext(conn)
    telemetry_app.state.pool = pool

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=telemetry_app),
        base_url="http://test",
    ) as client:
        response = await client.get("/readyz")
        assert response.status_code == 503
        assert response.json() == {"status": "unready"}


@pytest.mark.anyio
async def test_readyz_redis_failure_returns_503(telemetry_app):
    telemetry_app.state.redis.ping.side_effect = RuntimeError("redis down")

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=telemetry_app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/readyz/details",
            headers={"X-Health-Check-Token": "test-health-token"},
        )
        assert response.status_code == 503
        assert response.json()["checks"]["redis"] == "unready"

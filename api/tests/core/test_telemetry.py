from unittest.mock import AsyncMock

from fastapi import FastAPI
import httpx
import pytest

from app.core.middleware import RequestIDMiddleware, RequestLoggingMiddleware
from app.core.telemetry import get_metrics_registry, telemetry_router


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
    app.state.redis = redis
    app.state.pool = object()
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
        assert response.json()["checks"] == {"database": "ready", "redis": "ready"}

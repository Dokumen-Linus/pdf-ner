from unittest.mock import ANY, AsyncMock, MagicMock, patch

import pytest
from starlette.responses import JSONResponse

from app.core.middleware import (
    REQUEST_ID_HEADER,
    RequestIDMiddleware,
    RequestLoggingMiddleware,
    _get_route_label,
)


class TestGetRouteLabel:
    def test_returns_route_path_when_available(self):
        request = MagicMock()
        route = MagicMock()
        route.path = "/api/v1/pdfs"
        request.scope = {"route": route}
        assert _get_route_label(request) == "/api/v1/pdfs"

    def test_falls_back_to_url_path(self):
        request = MagicMock()
        request.scope = {"route": type("Route", (), {"path": ""})()}
        request.url.path = "/fallback"
        assert _get_route_label(request) == "/fallback"

    def test_falls_back_when_no_route(self):
        request = MagicMock()
        request.scope = {}
        request.url.path = "/no-route"
        assert _get_route_label(request) == "/no-route"


class TestRequestIDMiddleware:
    @pytest.mark.anyio
    async def test_uses_existing_request_id_header(self):
        app = MagicMock()
        call_next = AsyncMock(return_value=JSONResponse({"ok": True}))
        request = MagicMock()
        request.headers = {REQUEST_ID_HEADER: "existing-id"}
        request.state = MagicMock()

        middleware = RequestIDMiddleware(app)
        response = await middleware.dispatch(request, call_next)

        assert response.headers[REQUEST_ID_HEADER] == "existing-id"

    @pytest.mark.anyio
    async def test_generates_new_request_id(self):
        app = MagicMock()
        call_next = AsyncMock(return_value=JSONResponse({"ok": True}))
        request = MagicMock()
        request.headers = {}
        request.state = MagicMock()

        middleware = RequestIDMiddleware(app)
        response = await middleware.dispatch(request, call_next)

        assert response.headers[REQUEST_ID_HEADER] is not None


class TestRequestLoggingMiddleware:
    @pytest.mark.anyio
    async def test_logs_request(self):
        app = MagicMock()
        call_next = AsyncMock(return_value=JSONResponse({"ok": True}, status_code=200))
        request = MagicMock()
        request.method = "GET"
        request.url.path = "/health"
        request.state = MagicMock()
        request.state.request_id = "req-123"
        request.state.trace_id = "trace-abc"

        middleware = RequestLoggingMiddleware(app)
        response = await middleware.dispatch(request, call_next)

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_defaults_request_id(self):
        app = MagicMock()
        call_next = AsyncMock(return_value=JSONResponse({"ok": True}))
        request = MagicMock()
        request.method = "GET"
        request.url.path = "/health"
        request.state = MagicMock(spec=[])
        request.state.request_id = "-"
        request.state.trace_id = "-"

        middleware = RequestLoggingMiddleware(app)
        response = await middleware.dispatch(request, call_next)

        assert response.status_code == 200

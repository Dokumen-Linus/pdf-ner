import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .telemetry import bind_request_context, clear_request_context, extract_request_trace

logger = logging.getLogger("app.requests")

REQUEST_ID_HEADER = "X-Request-ID"


def _get_route_label(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path:
        return route_path
    return request.url.path


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        request.state.request_id = request_id
        bind_request_context(request_id=request_id)
        trace = extract_request_trace(request.headers)
        request.state.trace_id = trace["trace_id"]

        try:
            response = await call_next(request)
            response.headers[REQUEST_ID_HEADER] = request_id
            trace_id = getattr(request.state, "trace_id", None)
            if trace_id:
                response.headers["X-Trace-ID"] = trace_id
            return response
        finally:
            clear_request_context()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        bind_request_context(
            http_method=request.method,
            http_path=request.url.path,
        )
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration = time.perf_counter() - start
            request_id = getattr(request.state, "request_id", "-")
            route_label = _get_route_label(request)
            logger.info(
                "%s %s %d %.2fs [%s]",
                request.method,
                request.url.path,
                status_code,
                duration,
                request_id,
            )
            from .telemetry import record_api_http_request

            record_api_http_request(
                method=request.method,
                route=route_label,
                status_code=status_code,
                duration_s=duration,
            )
            clear_request_context("http_method", "http_path")

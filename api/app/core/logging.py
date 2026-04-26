from collections.abc import Mapping, MutableMapping
from pathlib import Path
import sys

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from .config import settings

_OBS_PATH = Path(__file__).resolve().parents[3] / "packages" / "otel_py"
if str(_OBS_PATH) not in sys.path:
    sys.path.insert(0, str(_OBS_PATH))

from otel_py import (  # noqa: E402
    ObservabilityConfig,
    bind_context,
    clear_context,
    configure_logging,
    extract_carrier,
    get_context_value,
    get_metrics_registry,
    inject_carrier,
    record_http_request,
)

_config = ObservabilityConfig.from_env(
    service="dokumen-api",
    version=settings.APP_VERSION,
    env=settings.ENV.value,
    runtime="fastapi",
)

telemetry_router = APIRouter()


def config_api_logging() -> None:
    configure_logging(_config)


def setup_api_telemetry() -> None:
    get_metrics_registry().set_gauge(
        "dokumen_service_info",
        1,
        labels={
            "service": _config.service,
            "version": _config.version,
            "env": _config.env,
        },
    )


def bind_request_context(**values: object) -> None:
    bind_context(
        service=_config.service,
        version=_config.version,
        env=_config.env,
        runtime=_config.runtime,
        **values,
    )


def clear_request_context(*keys: str) -> None:
    clear_context(*keys)


def extract_request_trace(headers: Mapping[str, str]) -> dict[str, str]:
    trace = extract_carrier(headers)
    bind_context(**trace)
    return trace


def record_api_http_request(
    *,
    method: str,
    route: str,
    status_code: int,
    duration_s: float,
) -> None:
    record_http_request(
        method=method,
        route=route,
        status_code=status_code,
        duration_s=duration_s,
        service=_config.service,
    )


def build_celery_headers(headers: MutableMapping[str, str] | None = None) -> dict[str, str]:
    payload = dict(headers or {})
    request_id = get_context_value("request_id") or payload.get("x-request-id")
    if request_id:
        payload["x-request-id"] = request_id
    return inject_carrier(payload)


@telemetry_router.get("/healthz")
async def healthz() -> JSONResponse:
    return JSONResponse(
        {
            "status": "healthy",
            "service": _config.service,
            "version": _config.version,
            "env": _config.env,
        }
    )


@telemetry_router.get("/readyz")
async def readyz(request: Request) -> JSONResponse:
    checks: dict[str, str] = {"database": "unknown", "redis": "unknown"}

    pool = getattr(request.app.state, "pool", None)
    checks["database"] = "ready" if pool is not None else "missing"

    redis = getattr(request.app.state, "redis", None)
    if redis is None:
        checks["redis"] = "missing"
    else:
        ping = getattr(redis, "ping", None)
        if callable(ping):
            try:
                result = await ping()
                checks["redis"] = "ready" if result else "degraded"
            except Exception:
                checks["redis"] = "error"
        else:
            checks["redis"] = "ready"

    status_code = 200 if all(value == "ready" for value in checks.values()) else 503
    body = {
        "status": "ready" if status_code == 200 else "degraded",
        "checks": checks,
    }
    return JSONResponse(body, status_code=status_code)


@telemetry_router.get("/metrics")
async def metrics() -> PlainTextResponse:
    return PlainTextResponse(get_metrics_registry().render_prometheus(), media_type="text/plain")

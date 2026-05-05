from collections.abc import Mapping, MutableMapping
from pathlib import Path
import sys

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from .config import settings
from .health import build_readiness_checks, overall_status

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
    return JSONResponse({"status": "healthy"})


@telemetry_router.get("/readyz")
async def readyz(request: Request) -> JSONResponse:
    pool = getattr(request.app.state, "pool", None)
    redis = getattr(request.app.state, "redis", None)
    checks = await build_readiness_checks(pool=pool, redis=redis)
    status = overall_status(checks)
    return JSONResponse({"status": status}, status_code=200 if status == "ready" else 503)


@telemetry_router.get("/readyz/details")
async def readyz_details(request: Request) -> JSONResponse:
    expected = settings.HEALTHCHECK_TOKEN
    provided = request.headers.get("X-Health-Check-Token")
    if not expected or provided != expected:
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    pool = getattr(request.app.state, "pool", None)
    redis = getattr(request.app.state, "redis", None)
    checks = await build_readiness_checks(pool=pool, redis=redis)
    status = overall_status(checks)
    return JSONResponse(
        {"status": status, "checks": checks},
        status_code=200 if status == "ready" else 503,
    )


@telemetry_router.get("/metrics")
async def metrics() -> PlainTextResponse:
    return PlainTextResponse(get_metrics_registry().render_prometheus(), media_type="text/plain")

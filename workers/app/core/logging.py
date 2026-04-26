from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
import sys
import time

from celery import Celery
from celery.signals import task_failure, task_postrun, task_prerun, task_retry, worker_ready

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
    get_metrics_registry,
    record_celery_task_event,
)

_config = ObservabilityConfig.from_env(
    service="dokumen-workers",
    version=settings.APP_VERSION,
    env=settings.ENV.value,
    runtime="celery",
)
_task_start_times: dict[str, float] = {}


def config_worker_logging() -> None:
    configure_logging(_config)


def setup_worker_telemetry() -> None:
    get_metrics_registry().set_gauge(
        "dokumen_service_info",
        1,
        labels={
            "service": _config.service,
            "version": _config.version,
            "env": _config.env,
        },
    )


def bind_worker_context(**values: object) -> None:
    bind_context(
        service=_config.service,
        version=_config.version,
        env=_config.env,
        runtime=_config.runtime,
        **values,
    )


def register_celery_observability(app: Celery) -> None:
    app._telemetry_registered = True


@worker_ready.connect
def _on_worker_ready(sender=None, **_: object) -> None:
    hostname = getattr(sender, "hostname", "unknown")
    bind_worker_context(hostname=hostname)
    get_metrics_registry().set_gauge(
        "dokumen_celery_workers_up",
        1,
        labels={"hostname": str(hostname), "service": _config.service},
    )


@task_prerun.connect
def _on_task_prerun(
    sender=None,
    task_id: str | None = None,
    task=None,
    args=None,
    kwargs=None,
    **_: object,
) -> None:
    _ = (sender, args, kwargs)
    request = getattr(task, "request", None)
    headers = getattr(request, "headers", {}) or {}
    if isinstance(headers, Mapping):
        extract_carrier({str(key): str(value) for key, value in headers.items()})

    queue_latency_s = None
    eta = getattr(request, "eta", None)
    if eta:
        try:
            queue_latency_s = max(
                0.0,
                (datetime.now(UTC) - datetime.fromisoformat(str(eta))).total_seconds(),
            )
        except Exception:
            queue_latency_s = None

    bind_worker_context(
        task_id=task_id,
        celery_task_name=getattr(task, "name", "unknown"),
        request_id=headers.get("x-request-id"),
    )
    if task_id is not None:
        _task_start_times[task_id] = time.perf_counter()

    record_celery_task_event(
        task_name=getattr(task, "name", "unknown"),
        status="started",
        queue_latency_s=queue_latency_s,
    )


@task_postrun.connect
def _on_task_postrun(
    task_id: str | None = None,
    task=None,
    state: str | None = None,
    **_: object,
) -> None:
    duration_s = None
    if task_id is not None and task_id in _task_start_times:
        duration_s = time.perf_counter() - _task_start_times.pop(task_id)

    record_celery_task_event(
        task_name=getattr(task, "name", "unknown"),
        status=(state or "finished").lower(),
        duration_s=duration_s,
    )
    clear_context()


@task_failure.connect
def _on_task_failure(
    task_id: str | None = None,
    exception: Exception | None = None,
    sender=None,
    **_: object,
) -> None:
    _ = task_id
    record_celery_task_event(
        task_name=getattr(sender, "name", "unknown"),
        status="failed",
    )
    bind_worker_context(error_type=type(exception).__name__ if exception else "Exception")


@task_retry.connect
def _on_task_retry(request=None, reason: Exception | None = None, sender=None, **_: object) -> None:
    _ = request
    bind_worker_context(error_type=type(reason).__name__ if reason else "Retry")
    record_celery_task_event(
        task_name=getattr(sender, "name", "unknown"),
        status="retry",
    )

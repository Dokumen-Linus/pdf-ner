from collections.abc import Iterator
from contextlib import contextmanager
import time

from .metrics import get_metrics_registry
from .semantic import (
    CELERY_TASK_DURATION_SECONDS,
    CELERY_TASK_QUEUE_LATENCY_SECONDS,
    CELERY_TASKS_TOTAL,
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_TOTAL,
    LLM_CALL_DURATION_SECONDS,
    LLM_CALLS_TOTAL,
    POSTGRES_OPERATION_DURATION_SECONDS,
    POSTGRES_OPERATIONS_TOTAL,
    REDIS_OPERATION_DURATION_SECONDS,
    REDIS_OPERATIONS_TOTAL,
)


def record_http_request(
    *,
    method: str,
    route: str,
    status_code: int,
    duration_s: float,
    service: str,
) -> None:
    labels = {
        "method": method,
        "route": route,
        "status_code": str(status_code),
        "service": service,
    }
    registry = get_metrics_registry()
    registry.increment(HTTP_REQUESTS_TOTAL, labels=labels)
    registry.observe(HTTP_REQUEST_DURATION_SECONDS, duration_s, labels=labels)


def record_celery_task_event(
    *,
    task_name: str,
    status: str,
    duration_s: float | None = None,
    queue_latency_s: float | None = None,
) -> None:
    labels = {"task": task_name, "status": status}
    registry = get_metrics_registry()
    registry.increment(CELERY_TASKS_TOTAL, labels=labels)
    if duration_s is not None:
        registry.observe(CELERY_TASK_DURATION_SECONDS, duration_s, labels={"task": task_name})
    if queue_latency_s is not None:
        registry.observe(
            CELERY_TASK_QUEUE_LATENCY_SECONDS,
            queue_latency_s,
            labels={"task": task_name},
        )


def record_llm_call(
    *,
    provider: str,
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    duration_s: float,
    success: bool,
    error_type: str | None = None,
) -> None:
    labels = {
        "provider": provider,
        "model": model,
        "success": str(success).lower(),
        "error_type": error_type or "none",
    }
    registry = get_metrics_registry()
    registry.increment(LLM_CALLS_TOTAL, labels=labels)
    registry.observe(LLM_CALL_DURATION_SECONDS, duration_s, labels=labels)
    if prompt_tokens is not None:
        registry.increment(
            "dokumen_llm_prompt_tokens_total",
            value=float(prompt_tokens),
            labels={"provider": provider, "model": model},
        )
    if completion_tokens is not None:
        registry.increment(
            "dokumen_llm_completion_tokens_total",
            value=float(completion_tokens),
            labels={"provider": provider, "model": model},
        )


@contextmanager
def observe_postgres_operation(operation: str, **attrs: object) -> Iterator[None]:
    labels = {"operation": operation, **{key: str(value) for key, value in attrs.items()}}
    start = time.perf_counter()
    try:
        yield
    except Exception:
        _record_operation(
            POSTGRES_OPERATIONS_TOTAL,
            POSTGRES_OPERATION_DURATION_SECONDS,
            start,
            {**labels, "success": "false"},
        )
        raise
    _record_operation(
        POSTGRES_OPERATIONS_TOTAL,
        POSTGRES_OPERATION_DURATION_SECONDS,
        start,
        {**labels, "success": "true"},
    )


@contextmanager
def observe_redis_operation(op: str, **attrs: object) -> Iterator[None]:
    labels = {"operation": op, **{key: str(value) for key, value in attrs.items()}}
    start = time.perf_counter()
    try:
        yield
    except Exception:
        _record_operation(
            REDIS_OPERATIONS_TOTAL,
            REDIS_OPERATION_DURATION_SECONDS,
            start,
            {**labels, "success": "false"},
        )
        raise
    _record_operation(
        REDIS_OPERATIONS_TOTAL,
        REDIS_OPERATION_DURATION_SECONDS,
        start,
        {**labels, "success": "true"},
    )


def _record_operation(
    counter_name: str,
    duration_name: str,
    start: float,
    labels: dict[str, str],
) -> None:
    duration_s = time.perf_counter() - start
    registry = get_metrics_registry()
    registry.increment(counter_name, labels=labels)
    registry.observe(duration_name, duration_s, labels=labels)

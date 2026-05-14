import pytest

from otel_py.instrumentation import (
    _record_operation,
    observe_postgres_operation,
    observe_redis_operation,
    record_celery_task_event,
    record_http_request,
    record_llm_call,
)
from otel_py.metrics import get_metrics_registry


class TestRecordHttpRequest:
    def test_records_counter_and_histogram(self):
        registry = get_metrics_registry()
        registry.reset()

        record_http_request(
            method="POST",
            route="/api/pdfs",
            status_code=201,
            duration_s=0.5,
            service="api",
        )

        snap = registry.snapshot()
        assert "dokumen_http_requests_total" in snap["counters"]
        assert "dokumen_http_request_duration_seconds" in snap["histograms"]

    def test_multiple_status_codes_have_separate_labels(self):
        registry = get_metrics_registry()
        registry.reset()

        record_http_request(
            method="GET", route="/health", status_code=200, duration_s=0.1, service="api"
        )
        record_http_request(
            method="GET", route="/health", status_code=500, duration_s=0.1, service="api"
        )

        snap = registry.snapshot()
        total_counter = snap["counters"]["dokumen_http_requests_total"]
        assert len(total_counter) == 2


class TestRecordCeleryTaskEvent:
    def test_records_counter_and_histograms(self):
        registry = get_metrics_registry()
        registry.reset()

        record_celery_task_event(
            task_name="ocr_task",
            status="SUCCESS",
            duration_s=10.0,
            queue_latency_s=1.5,
        )

        snap = registry.snapshot()
        assert "dokumen_celery_tasks_total" in snap["counters"]
        assert "dokumen_celery_task_duration_seconds" in snap["histograms"]
        assert "dokumen_celery_task_queue_latency_seconds" in snap["histograms"]

    def test_minimal_event(self):
        registry = get_metrics_registry()
        registry.reset()

        record_celery_task_event(task_name="task", status="FAILURE")

        snap = registry.snapshot()
        assert "dokumen_celery_tasks_total" in snap["counters"]


class TestRecordLlmCall:
    def test_records_counter_and_histogram(self):
        registry = get_metrics_registry()
        registry.reset()

        record_llm_call(
            provider="openai",
            model="gpt-4o",
            prompt_tokens=100,
            completion_tokens=50,
            duration_s=2.0,
            success=True,
        )

        snap = registry.snapshot()
        assert "dokumen_llm_calls_total" in snap["counters"]
        assert "dokumen_llm_call_duration_seconds" in snap["histograms"]

    def test_with_error_type(self):
        registry = get_metrics_registry()
        registry.reset()

        record_llm_call(
            provider="anthropic",
            model="claude-3",
            prompt_tokens=None,
            completion_tokens=None,
            duration_s=0.5,
            success=False,
            error_type="rate_limit",
        )

        snap = registry.snapshot()
        assert "dokumen_llm_calls_total" in snap["counters"]

    def test_no_token_counts(self):
        registry = get_metrics_registry()
        registry.reset()

        record_llm_call(
            provider="openai",
            model="gpt-4o",
            prompt_tokens=None,
            completion_tokens=None,
            duration_s=1.0,
            success=True,
        )

        snap = registry.snapshot()
        assert "dokumen_llm_prompt_tokens_total" not in snap["counters"]
        assert "dokumen_llm_completion_tokens_total" not in snap["counters"]


class TestObservePostgres:
    def test_success_records_operation(self):
        registry = get_metrics_registry()
        registry.reset()

        with observe_postgres_operation("SELECT", table="users"):
            pass

        snap = registry.snapshot()
        assert "dokumen_postgres_operations_total" in snap["counters"]

    def test_failure_records_operation(self):
        registry = get_metrics_registry()
        registry.reset()

        class TestError(Exception):
            pass

        with pytest.raises(TestError):
            with observe_postgres_operation("INSERT", table="docs"):
                raise TestError("db error")

        snap = registry.snapshot()
        assert "dokumen_postgres_operations_total" in snap["counters"]
        assert "dokumen_postgres_operation_duration_seconds" in snap["histograms"]


class TestObserveRedis:
    def test_success_records_operation(self):
        registry = get_metrics_registry()
        registry.reset()

        with observe_redis_operation("GET", key="session"):
            pass

        snap = registry.snapshot()
        assert "dokumen_redis_operations_total" in snap["counters"]

    def test_failure_records_operation(self):
        registry = get_metrics_registry()
        registry.reset()

        with pytest.raises(ConnectionError):
            with observe_redis_operation("SET", key="token"):
                raise ConnectionError("timeout")

        snap = registry.snapshot()
        assert "dokumen_redis_operations_total" in snap["counters"]


class TestRecordOperation:
    def test_records_counter_and_duration(self):
        registry = get_metrics_registry()
        registry.reset()

        _record_operation(
            "test_ops_total",
            "test_op_duration_seconds",
            0.0,
            {"operation": "test", "success": "true"},
        )

        snap = registry.snapshot()
        assert "test_ops_total" in snap["counters"]
        assert "test_op_duration_seconds" in snap["histograms"]

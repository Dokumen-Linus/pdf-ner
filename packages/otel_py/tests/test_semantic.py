from otel_py.semantic import (
    CELERY_TASK_DURATION_SECONDS,
    CELERY_TASK_QUEUE_LATENCY_SECONDS,
    CELERY_TASKS_TOTAL,
    CELERY_WORKERS_UP,
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_TOTAL,
    LLM_CALL_DURATION_SECONDS,
    LLM_CALLS_TOTAL,
    POSTGRES_OPERATIONS_TOTAL,
    POSTGRES_OPERATION_DURATION_SECONDS,
    REDIS_OPERATIONS_TOTAL,
    REDIS_OPERATION_DURATION_SECONDS,
)


class TestSemantic:
    def test_http_metrics(self):
        assert HTTP_REQUESTS_TOTAL == "dokumen_http_requests_total"
        assert HTTP_REQUEST_DURATION_SECONDS == "dokumen_http_request_duration_seconds"

    def test_celery_metrics(self):
        assert CELERY_TASKS_TOTAL == "dokumen_celery_tasks_total"
        assert CELERY_TASK_DURATION_SECONDS == "dokumen_celery_task_duration_seconds"
        assert CELERY_TASK_QUEUE_LATENCY_SECONDS == "dokumen_celery_task_queue_latency_seconds"
        assert CELERY_WORKERS_UP == "dokumen_celery_workers_up"

    def test_llm_metrics(self):
        assert LLM_CALLS_TOTAL == "dokumen_llm_calls_total"
        assert LLM_CALL_DURATION_SECONDS == "dokumen_llm_call_duration_seconds"

    def test_postgres_metrics(self):
        assert POSTGRES_OPERATIONS_TOTAL == "dokumen_postgres_operations_total"
        assert POSTGRES_OPERATION_DURATION_SECONDS == "dokumen_postgres_operation_duration_seconds"

    def test_redis_metrics(self):
        assert REDIS_OPERATIONS_TOTAL == "dokumen_redis_operations_total"
        assert REDIS_OPERATION_DURATION_SECONDS == "dokumen_redis_operation_duration_seconds"

    def test_all_defined(self):
        names = [
            HTTP_REQUESTS_TOTAL,
            HTTP_REQUEST_DURATION_SECONDS,
            CELERY_TASKS_TOTAL,
            CELERY_TASK_DURATION_SECONDS,
            CELERY_TASK_QUEUE_LATENCY_SECONDS,
            CELERY_WORKERS_UP,
            LLM_CALLS_TOTAL,
            LLM_CALL_DURATION_SECONDS,
            POSTGRES_OPERATIONS_TOTAL,
            POSTGRES_OPERATION_DURATION_SECONDS,
            REDIS_OPERATIONS_TOTAL,
            REDIS_OPERATION_DURATION_SECONDS,
        ]
        assert all(isinstance(n, str) and n.startswith("dokumen_") for n in names)

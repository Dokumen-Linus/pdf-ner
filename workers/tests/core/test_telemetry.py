from types import SimpleNamespace

from app.core.telemetry import (
    _on_task_postrun,
    _on_task_prerun,
    _on_worker_ready,
    get_metrics_registry,
)


def test_worker_ready_sets_up_gauge():
    get_metrics_registry().reset()

    _on_worker_ready(sender=SimpleNamespace(hostname="worker-1"))

    snapshot = get_metrics_registry().snapshot()
    gauges = snapshot["gauges"]["dokumen_celery_workers_up"]
    assert any("worker-1" in labels for labels in gauges)


def test_task_lifecycle_records_metrics():
    get_metrics_registry().reset()

    task = SimpleNamespace(
        name="context_engineering.optimize_prompt",
        request=SimpleNamespace(
            headers={
                "x-request-id": "req-123",
                "traceparent": "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
            },
            eta=None,
        ),
    )

    _on_task_prerun(task_id="task-1", task=task)
    _on_task_postrun(task_id="task-1", task=task, state="SUCCESS")

    snapshot = get_metrics_registry().snapshot()
    counters = snapshot["counters"]["dokumen_celery_tasks_total"]
    histograms = snapshot["histograms"]["dokumen_celery_task_duration_seconds"]
    assert any("started" in labels for labels in counters)
    assert any("success" in labels for labels in counters)
    assert any("context_engineering.optimize_prompt" in labels for labels in histograms)

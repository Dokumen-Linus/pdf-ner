from celery import Celery

from .core.config import settings
from .core.logging import (
    config_worker_logging,
    register_celery_observability,
    setup_worker_telemetry,
)

config_worker_logging()
setup_worker_telemetry()
app = Celery("myapp", broker=settings.CELERY_BROKER_URL)

app.config_from_object(settings, namespace="CELERY")

app.conf.task_track_started = True
app.conf.task_serializer = "json"
app.conf.result_serializer = "json"
app.conf.accept_content = ["json"]
app.conf.beat_schedule = {
    "billing-charge-due-accounts": {
        "task": "billing.charge_due_accounts",
        "schedule": 900.0,
    },
}

app.autodiscover_tasks(
    [
        "app.domains.billing",
        "app.domains.context_engineering",
        "app.domains.entity_extraction",
        "app.domains.ocr_evaluation",
        "app.domains.source_listeners",
        "app.domains.source_watchers",
    ]
)

register_celery_observability(app)

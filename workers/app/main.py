from celery import Celery
from .core.config import settings

app = Celery(
    "myapp",
    broker=settings.CELERY_BROKER_URL
)

app.config_from_object(settings, namespace="CELERY")

app.conf.task_track_started = True
app.conf.task_serializer = "json"
app.conf.result_serializer = "json"
app.conf.accept_content = ["json"]

app.auto_discover_tasks()
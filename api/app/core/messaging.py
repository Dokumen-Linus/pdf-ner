from celery import Celery

from .config import settings
from .telemetry import build_celery_headers

celery_client = Celery(
    "api",
    broker=settings.REDIS_URL,
)


def celery_message_headers(headers: dict[str, str] | None = None) -> dict[str, str]:
    return build_celery_headers(headers)

from celery import Celery

from .config import settings

celery_client = Celery(
    "api",
    broker=settings.REDIS_URL,
)

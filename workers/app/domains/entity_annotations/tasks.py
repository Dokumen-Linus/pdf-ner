from __future__ import annotations

import logging
from uuid import UUID

import anyio

from app.main import app

from .application.commands import CreatePredictedEntityAnnotations
from .application.handlers import handle_create_predicted_entity_annotations

logger = logging.getLogger(__name__)


@app.task(bind=True, name="entity_annotations.create_predicted_entity_annotations", max_retries=2)
def create_predicted_entity_annotations_task(
    self,
    ner_run_id: str,
    overwrite: bool = False,
) -> dict:
    cmd = CreatePredictedEntityAnnotations(
        ner_run_id=UUID(ner_run_id),
        overwrite=overwrite,
    )
    try:
        return anyio.run(handle_create_predicted_entity_annotations, cmd)
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        logger.error("Predicted entity annotation creation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

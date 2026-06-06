from __future__ import annotations

import logging
import time
from uuid import UUID

import anyio

from app.main import app
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync

from .application.commands import CreatePredictedEntityAnnotations
from .application.handlers import handle_create_predicted_entity_annotations

logger = logging.getLogger(__name__)


@app.task(bind=True, name="entity_annotations.create_predicted_entity_annotations", max_retries=2)
def create_predicted_entity_annotations_task(
    self,
    ner_run_id: str,
    overwrite: bool = False,
) -> dict:
    started_at = time.perf_counter()
    cmd = CreatePredictedEntityAnnotations(
        ner_run_id=UUID(ner_run_id),
        overwrite=overwrite,
    )
    metadata = {"ner_run_id": str(cmd.ner_run_id), "overwrite": cmd.overwrite}
    publish_task_lifecycle_event_sync(
        status="started",
        task=self,
        task_name="entity_annotations.create_predicted_entity_annotations",
        resource_type="ner_run",
        resource_id=str(cmd.ner_run_id),
        metadata=metadata,
        started_at=started_at,
    )
    try:
        result = anyio.run(handle_create_predicted_entity_annotations, cmd)
        publish_task_lifecycle_event_sync(
            status="succeeded",
            task=self,
            task_name="entity_annotations.create_predicted_entity_annotations",
            resource_type="ner_run",
            resource_id=str(cmd.ner_run_id),
            metadata={
                **metadata,
                "requested": result.get("requested"),
                "matched": result.get("matched"),
                "not_found": result.get("not_found"),
                "updated": result.get("updated"),
                "pdfs_changed": result.get("pdfs_changed"),
            },
            started_at=started_at,
        )
        return result
    except (LookupError, ValueError) as exc:
        publish_task_lifecycle_event_sync(
            status="failed",
            task=self,
            task_name="entity_annotations.create_predicted_entity_annotations",
            resource_type="ner_run",
            resource_id=str(cmd.ner_run_id),
            metadata=metadata,
            error=exc,
            started_at=started_at,
        )
        raise
    except Exception as exc:
        logger.error("Predicted entity annotation creation failed: %s", exc, exc_info=True)
        publish_task_lifecycle_event_sync(
            status="retrying",
            task=self,
            task_name="entity_annotations.create_predicted_entity_annotations",
            resource_type="ner_run",
            resource_id=str(cmd.ner_run_id),
            metadata={**metadata, "countdown": 60},
            error=exc,
            started_at=started_at,
        )
        raise self.retry(exc=exc, countdown=60) from exc

import logging
import time
from uuid import UUID

import anyio

from app.main import app
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync

from .application.commands import ProcessDocumentSource
from .application.handlers import handle_process_document_source

logger = logging.getLogger(__name__)


@app.task(bind=True, name="ner_workflows.process_document_source", max_retries=2)
def process_document_source_task(
    self,
    source_id: str,
    _deprecated_optimized_prompt_id: str | None = None,
) -> dict:
    started_at = time.perf_counter()
    cmd = ProcessDocumentSource(
        source_id=UUID(source_id),
    )
    metadata = {"source_id": str(cmd.source_id)}
    publish_task_lifecycle_event_sync(
        status="started",
        task=self,
        task_name="ner_workflows.process_document_source",
        resource_type="source",
        resource_id=str(cmd.source_id),
        metadata=metadata,
        started_at=started_at,
    )
    try:
        result = anyio.run(handle_process_document_source, cmd, self)
        publish_task_lifecycle_event_sync(
            status="succeeded",
            task=self,
            task_name="ner_workflows.process_document_source",
            project_id=UUID(result["project_id"]) if result.get("project_id") else None,
            resource_type="source",
            resource_id=str(cmd.source_id),
            metadata={
                **metadata,
                "run_id": result.get("run_id"),
                "pdf_id": result.get("pdf_id"),
                "extract_method": result.get("extract_method"),
                "model": result.get("model"),
            },
            started_at=started_at,
        )
        return result
    except (LookupError, ValueError) as exc:
        publish_task_lifecycle_event_sync(
            status="failed",
            task=self,
            task_name="ner_workflows.process_document_source",
            resource_type="source",
            resource_id=str(cmd.source_id),
            metadata=metadata,
            error=exc,
            started_at=started_at,
        )
        raise
    except Exception as exc:
        logger.error("Entity extraction failed: %s", exc, exc_info=True)
        publish_task_lifecycle_event_sync(
            status="retrying",
            task=self,
            task_name="ner_workflows.process_document_source",
            resource_type="source",
            resource_id=str(cmd.source_id),
            metadata={**metadata, "countdown": 60},
            error=exc,
            started_at=started_at,
        )
        raise self.retry(exc=exc, countdown=60) from exc

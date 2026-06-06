import logging
import time
from uuid import UUID

import anyio

from app.main import app
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync

from .application.commands import ExtractMissingPdfTexts
from .application.handlers import handle_extract_missing_pdf_texts

logger = logging.getLogger(__name__)


@app.task(bind=True, name="text_extract.extract_missing_pdf_texts", max_retries=2)
def extract_missing_pdf_texts_task(
    self,
    project_id: str,
    pdf_ids: list[str],
    extract_method: str,
) -> dict:
    started_at = time.perf_counter()
    cmd = ExtractMissingPdfTexts(
        project_id=UUID(project_id),
        pdf_ids=[UUID(pdf_id) for pdf_id in pdf_ids],
        extract_method=extract_method,
    )
    metadata = {"pdf_count": len(cmd.pdf_ids), "extract_method": cmd.extract_method}
    publish_task_lifecycle_event_sync(
        status="started",
        task=self,
        task_name="text_extract.extract_missing_pdf_texts",
        project_id=cmd.project_id,
        resource_type="project",
        resource_id=str(cmd.project_id),
        metadata=metadata,
        started_at=started_at,
    )
    try:
        result = anyio.run(handle_extract_missing_pdf_texts, cmd, self)
        publish_task_lifecycle_event_sync(
            status="succeeded",
            task=self,
            task_name="text_extract.extract_missing_pdf_texts",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={
                **metadata,
                "requested": result.get("requested"),
                "extracted": result.get("extracted"),
                "skipped": result.get("skipped"),
            },
            started_at=started_at,
        )
        return result
    except (LookupError, ValueError) as exc:
        publish_task_lifecycle_event_sync(
            status="failed",
            task=self,
            task_name="text_extract.extract_missing_pdf_texts",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata=metadata,
            error=exc,
            started_at=started_at,
        )
        raise
    except Exception as exc:
        logger.error("Text extraction batch failed: %s", exc, exc_info=True)
        publish_task_lifecycle_event_sync(
            status="retrying",
            task=self,
            task_name="text_extract.extract_missing_pdf_texts",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={**metadata, "countdown": 60},
            error=exc,
            started_at=started_at,
        )
        raise self.retry(exc=exc, countdown=60) from exc

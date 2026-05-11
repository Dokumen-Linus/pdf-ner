import logging
from uuid import UUID

import anyio

from app.main import app

from .application.commands import ProcessDocumentSource
from .application.handlers import handle_process_document_source

logger = logging.getLogger(__name__)


@app.task(bind=True, name="ner_workflows.process_document_source", max_retries=2)
def process_document_source_task(
    self,
    source_id: str,
    _deprecated_optimized_prompt_id: str | None = None,
) -> dict:
    cmd = ProcessDocumentSource(
        source_id=UUID(source_id),
    )
    try:
        return anyio.run(handle_process_document_source, cmd, self)
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        logger.error("Entity extraction failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

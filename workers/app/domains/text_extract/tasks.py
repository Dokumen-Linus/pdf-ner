import logging
from uuid import UUID

import anyio

from app.main import app

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
    cmd = ExtractMissingPdfTexts(
        project_id=UUID(project_id),
        pdf_ids=[UUID(pdf_id) for pdf_id in pdf_ids],
        extract_method=extract_method,
    )
    try:
        return anyio.run(handle_extract_missing_pdf_texts, cmd, self)
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        logger.error("Text extraction batch failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

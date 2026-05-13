from decimal import Decimal
import logging
from uuid import UUID

import anyio

from app.main import app

from .application.commands import EvaluateProjectOcr
from .application.handlers import handle_evaluate_project_ocr

logger = logging.getLogger(__name__)


@app.task(bind=True, name="ocr_evaluation.evaluate_project", max_retries=2)
def evaluate_project_ocr_task(
    self,
    project_id: str,
    judge_model: str,
    max_pdfs: int = 5,
    max_pages_per_pdf: int = 3,
    max_cost_usd: str = "0.50",
    gpu_model: str = "olm-ocr2",
    ocr_only: bool = True,
    pdf_ids: list[str] | None = None,
) -> dict:
    cmd = EvaluateProjectOcr(
        project_id=UUID(project_id),
        judge_model=judge_model,
        max_pdfs=max_pdfs,
        max_pages_per_pdf=max_pages_per_pdf,
        max_cost_usd=Decimal(max_cost_usd),
        gpu_model=gpu_model,
        ocr_only=ocr_only,
        pdf_ids=[UUID(pdf_id) for pdf_id in pdf_ids] if pdf_ids is not None else None,
    )
    try:
        return anyio.run(handle_evaluate_project_ocr, cmd, self)
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        logger.error("OCR evaluation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

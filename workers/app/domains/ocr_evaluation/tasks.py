from decimal import Decimal
import logging
import time
from uuid import UUID

import anyio

from app.main import app
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync

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
    started_at = time.perf_counter()
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
    metadata = {
        "judge_model": cmd.judge_model,
        "max_pdfs": cmd.max_pdfs,
        "max_pages_per_pdf": cmd.max_pages_per_pdf,
        "max_cost_usd": str(cmd.max_cost_usd),
        "gpu_model": cmd.gpu_model,
        "ocr_only": cmd.ocr_only,
        "pdf_count": len(cmd.pdf_ids or []),
        "has_explicit_pdf_ids": cmd.pdf_ids is not None,
    }
    publish_task_lifecycle_event_sync(
        status="started",
        task=self,
        task_name="ocr_evaluation.evaluate_project",
        project_id=cmd.project_id,
        resource_type="project",
        resource_id=str(cmd.project_id),
        metadata=metadata,
        started_at=started_at,
    )
    try:
        result = anyio.run(handle_evaluate_project_ocr, cmd, self)
        publish_task_lifecycle_event_sync(
            status="succeeded",
            task=self,
            task_name="ocr_evaluation.evaluate_project",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={
                **metadata,
                "run_id": result.get("run_id"),
                "recommendation": result.get("recommendation"),
                "sampled_pdf_count": result.get("sampled_pdf_count"),
                "sampled_page_count": result.get("sampled_page_count"),
                "cost_usd": result.get("cost_usd"),
            },
            started_at=started_at,
        )
        return result
    except (LookupError, ValueError) as exc:
        publish_task_lifecycle_event_sync(
            status="failed",
            task=self,
            task_name="ocr_evaluation.evaluate_project",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata=metadata,
            error=exc,
            started_at=started_at,
        )
        raise
    except Exception as exc:
        logger.error("OCR evaluation failed: %s", exc, exc_info=True)
        publish_task_lifecycle_event_sync(
            status="retrying",
            task=self,
            task_name="ocr_evaluation.evaluate_project",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={**metadata, "countdown": 60},
            error=exc,
            started_at=started_at,
        )
        raise self.retry(exc=exc, countdown=60) from exc

from decimal import Decimal
import logging
import time
from uuid import UUID

import anyio

from app.main import app
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync

from .application.commands import OptimizePrompt
from .application.handlers import handle_optimize_prompt

logger = logging.getLogger(__name__)


@app.task(bind=True, name="context_engineering.optimize_prompt", max_retries=2)
def optimize_prompt_task(
    self,
    project_id: str,
    template_id: int,
    labeled_pdfs: list[str],
    beta: float = 1.0,
    max_cost_usd: str = "1.00",
    ner_chat_model: str = "gpt-5.4-mini",
    prompt_eng_chat_model: str = "gpt-5.4-mini",
    convergence_threshold: float = 0.02,
):
    """Celery task to optimize NER prompts for a project."""
    logger.info("Starting prompt optimization: project=%s", project_id)
    started_at = time.perf_counter()
    cmd = OptimizePrompt(
        project_id=UUID(project_id),
        template_id=int(template_id),
        labeled_pdfs=[UUID(pdf_id) for pdf_id in labeled_pdfs],
        beta=float(beta),
        max_cost_usd=Decimal(max_cost_usd),
        ner_chat_model=ner_chat_model,
        prompt_eng_chat_model=prompt_eng_chat_model,
        convergence_threshold=float(convergence_threshold),
    )
    metadata = {
        "template_id": cmd.template_id,
        "labeled_pdf_count": len(cmd.labeled_pdfs),
        "beta": cmd.beta,
        "max_cost_usd": str(cmd.max_cost_usd),
        "ner_chat_model": cmd.ner_chat_model,
        "prompt_eng_chat_model": cmd.prompt_eng_chat_model,
        "convergence_threshold": cmd.convergence_threshold,
    }
    publish_task_lifecycle_event_sync(
        status="started",
        task=self,
        task_name="context_engineering.optimize_prompt",
        project_id=cmd.project_id,
        resource_type="project",
        resource_id=str(cmd.project_id),
        metadata=metadata,
        started_at=started_at,
    )
    try:
        result = anyio.run(handle_optimize_prompt, cmd, self)
        publish_task_lifecycle_event_sync(
            status="succeeded",
            task=self,
            task_name="context_engineering.optimize_prompt",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={
                **metadata,
                "best_prompt_id": result.get("best_prompt_id"),
                "best_f": result.get("best_f"),
                "iterations_run": result.get("iterations_run"),
                "cost_usd": result.get("cost_usd"),
            },
            started_at=started_at,
        )
        return result
    except Exception as exc:
        logger.error("Prompt optimization failed: %s", exc, exc_info=True)
        publish_task_lifecycle_event_sync(
            status="retrying",
            task=self,
            task_name="context_engineering.optimize_prompt",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={**metadata, "countdown": 60},
            error=exc,
            started_at=started_at,
        )
        raise self.retry(exc=exc, countdown=60) from exc

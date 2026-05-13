from decimal import Decimal
import logging
from uuid import UUID

import anyio

from app.main import app

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
    try:
        result = anyio.run(handle_optimize_prompt, cmd, self)
        return result
    except Exception as exc:
        logger.error("Prompt optimization failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

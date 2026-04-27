import asyncio
from decimal import Decimal
import logging
from uuid import UUID

from app.main import app

from .application.commands import OptimizePrompt
from .application.handlers import handle_optimize_prompt

logger = logging.getLogger(__name__)


@app.task(bind=True, name="context_engineering.optimize_prompt", max_retries=2)
def optimize_prompt_task(self, project_id: str, max_cost_usd: str = "1.00", model: str = "gpt-4o"):
    """Celery task to optimize NER prompts for a project."""
    logger.info("Starting prompt optimization: project=%s", project_id)
    cmd = OptimizePrompt(
        project_id=UUID(project_id),
        max_cost_usd=Decimal(max_cost_usd),
        model=model,
    )
    try:
        result = asyncio.run(handle_optimize_prompt(cmd, task=self))
        return result
    except Exception as exc:
        logger.error("Prompt optimization failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

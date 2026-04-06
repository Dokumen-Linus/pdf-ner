import asyncio
import logging
from uuid import UUID

from app.main import app

from .application.commands import OptimizePrompt
from .application.handlers import handle_optimize_prompt

logger = logging.getLogger(__name__)


@app.task(bind=True, name="context_engineering.optimize_prompt", max_retries=2)
def optimize_prompt_task(self, project_id: str, max_iterations: int = 5, model: str = "gpt-4o"):
    """Celery task to optimize NER prompts for a project."""
    logger.info("Starting prompt optimization: project=%s", project_id)
    cmd = OptimizePrompt(
        project_id=UUID(project_id),
        max_iterations=max_iterations,
        model=model,
    )
    try:
        result = asyncio.run(handle_optimize_prompt(cmd))
        return result
    except Exception as exc:
        logger.error("Prompt optimization failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

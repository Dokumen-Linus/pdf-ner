from __future__ import annotations

import logging
from uuid import UUID

import anyio

from app.main import app

from .application.commands import ActivateProjectPrompt
from .application.handlers import handle_activate_project_prompt

logger = logging.getLogger(__name__)


@app.task(bind=True, name="prompt_activation.activate_project_prompt", max_retries=2)
def activate_project_prompt_task(self, project_id: str, prompt_id: str) -> dict:
    cmd = ActivateProjectPrompt(project_id=UUID(project_id), prompt_id=UUID(prompt_id))
    try:
        return anyio.run(handle_activate_project_prompt, cmd)
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        logger.error("Prompt activation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

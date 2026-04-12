from __future__ import annotations

import logging
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.shared.infrastructure.db import get_pool

from .commands import OptimizePrompt
from .workflows import prompt_optimization_workflow

logger = logging.getLogger(__name__)


async def handle_optimize_prompt(cmd: OptimizePrompt, task: Any | None = None) -> dict:
    """Handle the OptimizePrompt command."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        result = await prompt_optimization_workflow(conn, client, cmd, task=task)
        logger.info(
            "Prompt optimization complete: project=%s, f1=%.4f, prompt_id=%s",
            cmd.project_id,
            result["best_f1"],
            result["best_prompt_id"],
        )
        return result

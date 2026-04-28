from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.integrations.gemini import Client as GeminiClient
from app.shared.infrastructure.db import get_pool

from .commands import EvaluateProjectOcr
from .workflows import evaluate_project_ocr_workflow


async def handle_evaluate_project_ocr(
    cmd: EvaluateProjectOcr,
    task: Any | None = None,
) -> dict:
    pool = await get_pool()
    client = GeminiClient(api_key=settings.GOOGLE_AI_API_KEY)
    return await evaluate_project_ocr_workflow(pool, client, cmd, task=task)

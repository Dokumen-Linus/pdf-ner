from __future__ import annotations

from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.integrations.anthropic import AsyncAnthropic
from app.integrations.gemini import Client as GeminiClient
from app.shared.infrastructure.db import get_pool

from .commands import EvaluateChatModels
from .workflows import evaluate_chat_models_workflow


async def handle_evaluate_chat_models(
    cmd: EvaluateChatModels,
    task: Any | None = None,
) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        clients = {
            "anthropic": AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY),
            "openai": AsyncOpenAI(api_key=settings.OPENAI_API_KEY),
            "gemini": GeminiClient(api_key=settings.GOOGLE_AI_API_KEY),
        }
        return await evaluate_chat_models_workflow(conn, clients, cmd, task=task)

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.integrations.anthropic import AsyncAnthropic
from app.integrations.gemini import Client as GeminiClient
from app.integrations.openai import AsyncOpenAI
from app.shared.infrastructure.db import get_pool
from app.shared.infrastructure.redis import RedisLock

from .commands import ProcessDocumentSource
from .workflows import process_document_source_workflow


async def handle_process_document_source(
    cmd: ProcessDocumentSource,
    task: Any | None = None,
) -> dict:
    async with RedisLock(f"ner_workflows:{cmd.document_source_id}", ttl=1800) as lock:
        if not lock.acquired:
            return {"status": "skipped", "reason": "locked"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            clients = {
                "anthropic": AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY),
                "openai": AsyncOpenAI(api_key=settings.OPENAI_API_KEY),
                "gemini": GeminiClient(api_key=settings.GOOGLE_AI_API_KEY),
            }
            return await process_document_source_workflow(conn, clients, cmd, task=task)

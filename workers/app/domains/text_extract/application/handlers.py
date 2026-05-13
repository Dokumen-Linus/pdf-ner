from __future__ import annotations

from typing import Any

from app.shared.infrastructure.db import get_pool

from .commands import ExtractMissingPdfTexts
from .workflows import extract_missing_pdf_texts_workflow


async def handle_extract_missing_pdf_texts(
    cmd: ExtractMissingPdfTexts,
    task: Any | None = None,
) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await extract_missing_pdf_texts_workflow(conn, cmd, task=task)

from __future__ import annotations

from app.shared.infrastructure.db import get_pool

from .commands import ActivateProjectPrompt
from .workflows import activate_project_prompt_workflow


async def handle_activate_project_prompt(cmd: ActivateProjectPrompt) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await activate_project_prompt_workflow(conn, cmd)

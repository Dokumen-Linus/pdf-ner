from __future__ import annotations

import asyncpg

from app.shared.infrastructure.prompts import ensure_prompt_full_text

from ..infrastructure import repositories as repo
from .commands import ActivateProjectPrompt


async def activate_project_prompt_workflow(
    conn: asyncpg.Connection,
    cmd: ActivateProjectPrompt,
) -> dict:
    full_text = await ensure_prompt_full_text(conn, cmd.prompt_id, cmd.project_id)
    if not full_text:
        raise ValueError(f"Prompt rendered empty text: {cmd.prompt_id}")

    await repo.activate_project_prompt(conn, project_id=cmd.project_id, prompt_id=cmd.prompt_id)
    return {
        "project_id": str(cmd.project_id),
        "prompt_id": str(cmd.prompt_id),
        "full_text_materialized": True,
    }

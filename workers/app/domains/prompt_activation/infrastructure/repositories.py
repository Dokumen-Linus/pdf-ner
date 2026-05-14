from __future__ import annotations

from uuid import UUID

import asyncpg


async def activate_project_prompt(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    prompt_id: UUID,
) -> None:
    result = await conn.execute(
        """
        UPDATE web.projects
        SET active_prompt_id = $2
        WHERE id = $1
        """,
        project_id,
        prompt_id,
    )
    if result == "UPDATE 0":
        raise ValueError(f"Project not found: {project_id}")

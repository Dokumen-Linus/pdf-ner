from typing import cast
from uuid import UUID

import asyncpg


async def fetch_pdf_ids_outside_project(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    pdf_ids: list[UUID],
) -> list[UUID]:
    rows = await conn.fetch(
        """
        SELECT requested.id
        FROM unnest($2::uuid[]) AS requested(id)
        LEFT JOIN core.pdfs p
          ON p.id = requested.id
         AND p.project_id = $1
        WHERE p.id IS NULL
        """,
        project_id,
        pdf_ids,
    )
    return [cast(UUID, row["id"]) for row in rows]


async def fetch_unavailable_chat_model_ids(
    conn: asyncpg.Connection,
    *,
    chat_model_ids: list[str],
) -> list[str]:
    rows = await conn.fetch(
        """
        SELECT requested.id
        FROM unnest($1::text[]) AS requested(id)
        LEFT JOIN public.chat_models cm
          ON cm.id = requested.id
         AND (cm.end_available_date IS NULL OR cm.end_available_date > now())
        WHERE cm.id IS NULL
        """,
        chat_model_ids,
    )
    return [row["id"] for row in rows]


async def prompt_belongs_to_project(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    prompt_id: UUID,
) -> bool:
    return bool(
        await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM core.prompts
                WHERE id = $1
                  AND project_id = $2
            )
            """,
            prompt_id,
            project_id,
        )
    )

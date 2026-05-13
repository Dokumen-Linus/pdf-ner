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
    return [row["id"] for row in rows]

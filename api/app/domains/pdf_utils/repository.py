from uuid import UUID

import asyncpg


async def fetch_pdf(conn: asyncpg.Connection, pdf_id: UUID) -> asyncpg.Record | None:
    """Fetch PDF location (S3 key) and bucket via workers.pdfs → web.projects."""
    return await conn.fetchrow(
        """
        SELECT w.location, w.name, w.project_id, p.bucket
        FROM workers.pdfs w
        JOIN web.projects p ON p.id = w.project_id
        WHERE w.id = $1
        """,
        pdf_id,
    )

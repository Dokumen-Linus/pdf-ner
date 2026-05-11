from uuid import UUID

import asyncpg


async def fetch_pdf_bucket_info(conn: asyncpg.Connection, pdf_id: UUID) -> asyncpg.Record | None:
    """Fetch filepath and bucket location for a PDF."""
    return await conn.fetchrow(
        """
        SELECT p.filepath, ab.name AS bucket_name, ab.region, ab.endpoint_url
        FROM core.pdfs p
        JOIN web.projects pr ON pr.id = p.project_id
        JOIN api.aws_buckets ab ON ab.id = pr.bucket_id
        WHERE p.id = $1
        """,
        pdf_id,
    )

from uuid import UUID

import asyncpg


async def fetch_pdf(conn: asyncpg.Connection, pdf_id: UUID) -> asyncpg.Record | None:
    """Fetch PDF filepath, bucket credentials, and metadata via workers.pdfs → api.aws_buckets."""
    return await conn.fetchrow(
        """
        SELECT w.filepath, w.name, w.project_id,
               ab.name AS bucket_name, ab.region,
               ab.access_key_id, ab.secret_access_key, ab.endpoint_url
        FROM workers.pdfs w
        JOIN api.aws_buckets ab ON ab.id = w.bucket_id
        WHERE w.id = $1
        """,
        pdf_id,
    )

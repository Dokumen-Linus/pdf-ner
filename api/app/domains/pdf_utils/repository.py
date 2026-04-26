import json
from uuid import UUID

import asyncpg


async def fetch_pdf(conn: asyncpg.Connection, pdf_id: UUID) -> asyncpg.Record | None:
    """Fetch PDF filepath, bucket credentials, and metadata via workers.pdfs → api.aws_buckets."""
    return await conn.fetchrow(
        """
        SELECT w.filepath, w.name, w.project_id,
               w.full_text, w.extract_method, w.text_by_page,
               ab.name AS bucket_name, ab.region,
               ab.access_key_id, ab.secret_access_key, ab.endpoint_url
        FROM workers.pdfs w
        JOIN api.aws_buckets ab ON ab.id = w.bucket_id
        WHERE w.id = $1
        """,
        pdf_id,
    )


async def update_pdf_text_metadata(
    conn: asyncpg.Connection,
    pdf_id: UUID,
    *,
    full_text: str,
    extract_method: str,
    text_by_page: dict,
) -> None:
    """Persist extracted text metadata on workers.pdfs."""
    await conn.execute(
        """
        UPDATE workers.pdfs
        SET full_text = $2,
            extract_method = $3,
            text_by_page = $4::jsonb
        WHERE id = $1
        """,
        pdf_id,
        full_text,
        extract_method,
        json.dumps(text_by_page),
    )

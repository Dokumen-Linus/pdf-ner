import json
from uuid import UUID

import asyncpg


async def fetch_pdf(conn: asyncpg.Connection, pdf_id: UUID) -> asyncpg.Record | None:
    """Fetch PDF filepath, bucket location, and latest extracted text metadata."""
    return await conn.fetchrow(
        """
        SELECT p.filepath, p.project_id,
               txt.txt AS full_text,
               txt.ocr_method AS extract_method,
               txt.text_by_page,
               ab.name AS bucket_name, ab.region, ab.endpoint_url
        FROM core.pdfs p
        JOIN web.projects pr ON pr.id = p.project_id
        JOIN api.aws_buckets ab ON ab.id = pr.bucket_id
        LEFT JOIN LATERAL (
            SELECT txt, ocr_method, text_by_page
            FROM workers.pdf_txts
            WHERE pdf_id = p.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) txt ON true
        WHERE p.id = $1
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
    """Persist extracted text metadata in workers.pdf_txts."""
    await conn.execute(
        """
        INSERT INTO workers.pdf_txts
            (pdf_id, ocr_method, created_by_domain, txt, text_by_page)
        VALUES ($1, $2, 'api_pdf_utils', $3, $4::jsonb)
        """,
        pdf_id,
        extract_method,
        full_text,
        json.dumps(text_by_page),
    )

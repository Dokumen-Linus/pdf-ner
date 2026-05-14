from __future__ import annotations

import json
from typing import cast
from uuid import UUID

import asyncpg

from ..domain.entities import StoredPdfText


async def fetch_project_pdf_text_status(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    pdf_ids: list[UUID],
    extract_method: str,
) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT p.id AS pdf_id,
               EXISTS (
                   SELECT 1
                   FROM workers.pdf_txts txt
                   WHERE txt.pdf_id = p.id
                     AND txt.extract_method = $3
               ) AS has_text
        FROM core.pdfs p
        WHERE p.project_id = $1
          AND p.id = ANY($2::uuid[])
        """,
        project_id,
        pdf_ids,
        extract_method,
    )


async def pdf_text_exists(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    extract_method: str,
) -> bool:
    return bool(
        await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM workers.pdf_txts
                WHERE pdf_id = $1
                  AND extract_method = $2
            )
            """,
            pdf_id,
            extract_method,
        )
    )


async def fetch_latest_pdf_text(
    conn: asyncpg.Connection,
    pdf_id: UUID,
) -> StoredPdfText | None:
    row = await conn.fetchrow(
        """
        SELECT id, pdf_id, txt, extract_method, text_by_page
        FROM workers.pdf_txts
        WHERE pdf_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        pdf_id,
    )
    if row is None:
        return None
    return StoredPdfText(
        pdf_txt_id=row["id"],
        pdf_id=cast(UUID, row["pdf_id"]),
        full_text=row["txt"],
        extract_method=row["extract_method"],
        text_by_page=row["text_by_page"],
    )


async def insert_pdf_text(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    full_text: str,
    extract_method: str,
    created_by_domain: str,
    text_by_page: dict,
) -> int:
    return cast(
        int,
        await conn.fetchval(
            """
        INSERT INTO workers.pdf_txts
            (pdf_id, extract_method, created_by_domain, txt, text_by_page)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
        """,
            pdf_id,
            extract_method,
            created_by_domain,
            full_text,
            json.dumps(text_by_page),
        ),
    )

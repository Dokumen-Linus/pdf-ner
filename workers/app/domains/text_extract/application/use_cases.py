from __future__ import annotations

from uuid import UUID

import asyncpg

from app.shared.infrastructure.s3 import download_pdf_bytes

from ..domain.entities import ExtractionResult
from ..domain.value_objects import (
    has_usable_text,
    join_page_text,
    text_by_page_payload,
    validate_extract_method,
    validate_ocr_method,
)
from ..infrastructure import ocr
from ..infrastructure import repositories as repo


async def extract_default_text(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    extract_method: str,
    created_by_domain: str,
    ocr_only: bool = False,
) -> ExtractionResult:
    if ocr_only:
        validate_ocr_method(extract_method)
    else:
        validate_extract_method(extract_method)
        stored = await repo.fetch_latest_pdf_text(conn, pdf_id)
        if stored is not None and has_usable_text(stored.full_text):
            return ExtractionResult(
                pdf_id=pdf_id,
                full_text=stored.full_text,
                text_by_page=stored.text_by_page
                or {"pages": [{"page_index": 0, "text": stored.full_text}]},
                extract_method=stored.extract_method,
                pdf_txt_id=stored.pdf_txt_id,
            )

    pdf_bytes, _filepath = await download_pdf_bytes(conn, pdf_id)
    if not ocr_only:
        pages = await ocr.extract_pdfium_pages(pdf_bytes)
        full_text = join_page_text(pages)
        if has_usable_text(full_text):
            return await _persist_result(
                conn,
                pdf_id=pdf_id,
                pages=pages,
                extract_method="pdfium",
                created_by_domain=created_by_domain,
            )
        if extract_method == "pdfium":
            raise ValueError("No text extracted from PDF with PDFium")

    return await _extract_and_persist_ocr(
        conn,
        pdf_id=pdf_id,
        pdf_bytes=pdf_bytes,
        ocr_method=extract_method,
        created_by_domain=created_by_domain,
    )


async def extract_exact_text(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    extract_method: str,
    created_by_domain: str,
    project_id: UUID | None = None,
) -> ExtractionResult:
    validate_extract_method(extract_method)
    pdf_bytes, _filepath = await download_pdf_bytes(conn, pdf_id, project_id)
    if extract_method == "pdfium":
        pages = await ocr.extract_pdfium_pages(pdf_bytes)
    else:
        pages = await ocr.extract_ocr_pages(pdf_bytes, extract_method)

    return await _persist_result(
        conn,
        pdf_id=pdf_id,
        pages=pages,
        extract_method=extract_method,
        created_by_domain=created_by_domain,
        require_text=False,
    )


async def _extract_and_persist_ocr(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    pdf_bytes: bytes,
    ocr_method: str,
    created_by_domain: str,
) -> ExtractionResult:
    validate_ocr_method(ocr_method)
    pages = await ocr.extract_ocr_pages(pdf_bytes, ocr_method)
    return await _persist_result(
        conn,
        pdf_id=pdf_id,
        pages=pages,
        extract_method=ocr_method,
        created_by_domain=created_by_domain,
    )


async def _persist_result(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    pages,
    extract_method: str,
    created_by_domain: str,
    require_text: bool = True,
) -> ExtractionResult:
    full_text = join_page_text(pages)
    if require_text and not has_usable_text(full_text):
        raise ValueError("No text extracted from PDF")
    payload = text_by_page_payload(pages)
    pdf_txt_id = await repo.insert_pdf_text(
        conn,
        pdf_id=pdf_id,
        full_text=full_text,
        extract_method=extract_method,
        created_by_domain=created_by_domain,
        text_by_page=payload,
    )
    return ExtractionResult(
        pdf_id=pdf_id,
        full_text=full_text,
        text_by_page=payload,
        extract_method=extract_method,
        pdf_txt_id=pdf_txt_id,
    )

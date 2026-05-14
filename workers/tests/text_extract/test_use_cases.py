from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.domains.text_extract.application import use_cases
from app.domains.text_extract.domain.entities import StoredPdfText
from app.domains.text_extract.domain.value_objects import PageText


@pytest.mark.anyio
async def test_pdfium_text_persists_and_skips_ocr():
    conn = AsyncMock()
    pdf_id = uuid4()
    pdf_txt_id = 1

    with (
        patch.object(use_cases.repo, "fetch_latest_pdf_text", new=AsyncMock(return_value=None)),
        patch.object(
            use_cases, "download_pdf_bytes", new=AsyncMock(return_value=(b"pdf", "x.pdf"))
        ),
        patch.object(
            use_cases.ocr,
            "extract_pdfium_pages",
            new=AsyncMock(return_value=[PageText(0, "embedded text")]),
        ),
        patch.object(use_cases.ocr, "extract_ocr_pages", new=AsyncMock()) as ocr_pages,
        patch.object(
            use_cases.repo,
            "insert_pdf_text",
            new=AsyncMock(return_value=pdf_txt_id),
        ) as insert_text,
    ):
        result = await use_cases.extract_default_text(
            conn,
            pdf_id=pdf_id,
            extract_method="olm-ocr2",
            created_by_domain="ner_workflows",
        )

    assert result.full_text == "embedded text"
    assert result.extract_method == "pdfium"
    assert result.pdf_txt_id == pdf_txt_id
    ocr_pages.assert_not_awaited()
    insert_text.assert_awaited_once()


@pytest.mark.anyio
async def test_blank_pdfium_falls_back_to_selected_ocr():
    conn = AsyncMock()
    pdf_id = uuid4()

    with (
        patch.object(use_cases.repo, "fetch_latest_pdf_text", new=AsyncMock(return_value=None)),
        patch.object(
            use_cases, "download_pdf_bytes", new=AsyncMock(return_value=(b"pdf", "x.pdf"))
        ),
        patch.object(
            use_cases.ocr,
            "extract_pdfium_pages",
            new=AsyncMock(return_value=[PageText(0, "   ")]),
        ),
        patch.object(
            use_cases.ocr,
            "extract_ocr_pages",
            new=AsyncMock(return_value=[PageText(0, "ocr text")]),
        ) as ocr_pages,
        patch.object(use_cases.repo, "insert_pdf_text", new=AsyncMock(return_value=2)),
    ):
        result = await use_cases.extract_default_text(
            conn,
            pdf_id=pdf_id,
            extract_method="deepseek-ocr",
            created_by_domain="ner_workflows",
        )

    assert result.extract_method == "deepseek-ocr"
    ocr_pages.assert_awaited_once()


@pytest.mark.anyio
async def test_ocr_only_skips_pdfium():
    conn = AsyncMock()
    pdf_id = uuid4()

    with (
        patch.object(use_cases.repo, "fetch_latest_pdf_text", new=AsyncMock()) as fetch_text,
        patch.object(
            use_cases, "download_pdf_bytes", new=AsyncMock(return_value=(b"pdf", "x.pdf"))
        ),
        patch.object(use_cases.ocr, "extract_pdfium_pages", new=AsyncMock()) as pdfium_pages,
        patch.object(
            use_cases.ocr,
            "extract_ocr_pages",
            new=AsyncMock(return_value=[PageText(0, "ocr text")]),
        ),
        patch.object(use_cases.repo, "insert_pdf_text", new=AsyncMock(return_value=3)),
    ):
        result = await use_cases.extract_default_text(
            conn,
            pdf_id=pdf_id,
            extract_method="tesseract",
            created_by_domain="ner_workflows",
            ocr_only=True,
        )

    assert result.extract_method == "tesseract"
    fetch_text.assert_not_awaited()
    pdfium_pages.assert_not_awaited()


@pytest.mark.anyio
async def test_reuses_stored_text_when_available():
    conn = AsyncMock()
    pdf_id = uuid4()
    pdf_txt_id = 4

    with patch.object(
        use_cases.repo,
        "fetch_latest_pdf_text",
        new=AsyncMock(
            return_value=StoredPdfText(
                pdf_txt_id=pdf_txt_id,
                pdf_id=pdf_id,
                full_text="stored",
                extract_method="tesseract",
                text_by_page={"pages": [{"page_index": 0, "text": "stored"}]},
            )
        ),
    ):
        result = await use_cases.extract_default_text(
            conn,
            pdf_id=pdf_id,
            extract_method="olm-ocr2",
            created_by_domain="ner_workflows",
        )

    assert result.full_text == "stored"
    assert result.pdf_txt_id == pdf_txt_id


@pytest.mark.anyio
async def test_exact_candidate_persists_created_by_domain_and_method():
    conn = AsyncMock()
    pdf_id = uuid4()

    with (
        patch.object(
            use_cases, "download_pdf_bytes", new=AsyncMock(return_value=(b"pdf", "x.pdf"))
        ),
        patch.object(
            use_cases.ocr,
            "extract_ocr_pages",
            new=AsyncMock(return_value=[PageText(0, "ocr text")]),
        ),
        patch.object(
            use_cases.repo,
            "insert_pdf_text",
            new=AsyncMock(return_value=5),
        ) as insert_text,
    ):
        result = await use_cases.extract_exact_text(
            conn,
            pdf_id=pdf_id,
            extract_method="olm-ocr2",
            created_by_domain="ocr_evaluation",
        )

    assert result.extract_method == "olm-ocr2"
    insert_text.assert_awaited_once()
    assert insert_text.await_args.kwargs["extract_method"] == "olm-ocr2"
    assert insert_text.await_args.kwargs["created_by_domain"] == "ocr_evaluation"

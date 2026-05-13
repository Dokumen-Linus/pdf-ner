from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.domains.text_extract.application.commands import ExtractMissingPdfTexts
from app.domains.text_extract.application.workflows import extract_missing_pdf_texts_workflow


@pytest.mark.anyio
async def test_extract_missing_pdf_texts_skips_existing_method_entries():
    conn = AsyncMock()
    project_id = uuid4()
    first_pdf_id = uuid4()
    second_pdf_id = uuid4()
    task = MagicMock()

    status_rows = [
        {"pdf_id": first_pdf_id, "has_text": True},
        {"pdf_id": second_pdf_id, "has_text": False},
    ]
    fetch_status = AsyncMock(return_value=status_rows)
    extract_text = AsyncMock()

    with (
        patch(
            "app.domains.text_extract.application.workflows.repo.fetch_project_pdf_text_status",
            new=fetch_status,
        ),
        patch(
            "app.domains.text_extract.application.workflows.extract_exact_text",
            new=extract_text,
        ),
    ):
        result = await extract_missing_pdf_texts_workflow(
            conn,
            ExtractMissingPdfTexts(
                project_id=project_id,
                pdf_ids=[first_pdf_id, second_pdf_id],
                extract_method="pdfium",
            ),
            task=task,
        )

    assert result == {
        "project_id": str(project_id),
        "extract_method": "pdfium",
        "requested": 2,
        "extracted": 1,
        "skipped": 1,
        "extracted_pdf_ids": [str(second_pdf_id)],
        "skipped_pdf_ids": [str(first_pdf_id)],
    }
    fetch_status.assert_awaited_once_with(
        conn,
        project_id=project_id,
        pdf_ids=[first_pdf_id, second_pdf_id],
        extract_method="pdfium",
    )
    extract_text.assert_awaited_once_with(
        conn,
        pdf_id=second_pdf_id,
        extract_method="pdfium",
        created_by_domain="text_extract",
        project_id=project_id,
    )
    assert task.update_state.call_count == 2


@pytest.mark.anyio
async def test_extract_missing_pdf_texts_rejects_pdfs_outside_project():
    conn = AsyncMock()
    project_id = uuid4()
    pdf_id = uuid4()

    with patch(
        "app.domains.text_extract.application.workflows.repo.fetch_project_pdf_text_status",
        new=AsyncMock(return_value=[]),
    ):
        with pytest.raises(LookupError, match="PDFs not found for project"):
            await extract_missing_pdf_texts_workflow(
                conn,
                ExtractMissingPdfTexts(
                    project_id=project_id,
                    pdf_ids=[pdf_id],
                    extract_method="pdfium",
                ),
            )

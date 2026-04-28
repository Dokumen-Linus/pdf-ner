from contextlib import asynccontextmanager
from decimal import Decimal
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domains.ocr_evaluation.application import workflows
from app.domains.ocr_evaluation.application.commands import EvaluateProjectOcr
from app.domains.ocr_evaluation.application.handlers import handle_evaluate_project_ocr
from app.domains.ocr_evaluation.domain.entities import PageOcrText, SampledPdf
from app.shared.domain.LLMResponseData import LLMResponseData
from tests.conftest import PDF_ID_1, PROJECT_ID


def _make_pool_mock(mock_conn):
    mock_pool = MagicMock()

    @asynccontextmanager
    async def acquire():
        yield mock_conn

    mock_pool.acquire = acquire
    return mock_pool


@pytest.mark.anyio
async def test_workflow_rejects_non_gemini_model():
    conn = AsyncMock()
    cmd = EvaluateProjectOcr(project_id=PROJECT_ID, judge_model="gpt-4o")

    with (
        patch.object(workflows.repo, "fetch_project_exists", new=AsyncMock(return_value=True)),
        patch.object(
            workflows.repo,
            "fetch_available_gemini_model",
            new=AsyncMock(return_value=False),
        ),
    ):
        with pytest.raises(ValueError, match="available Gemini model"):
            await workflows.evaluate_project_ocr_workflow(_make_pool_mock(conn), object(), cmd)


@pytest.mark.anyio
async def test_workflow_scores_pages_and_persists_recommendation():
    conn = AsyncMock()
    cmd = EvaluateProjectOcr(
        project_id=PROJECT_ID,
        judge_model="gemini-2.0-flash",
        max_pdfs=1,
        max_pages_per_pdf=1,
    )
    judge_payload = json.dumps(
        {
            "best_method": "tesseract",
            "tesseract_usable": True,
            "olm_usable": True,
            "confidence": 0.9,
            "quality_scores": {"tesseract": 0.9, "olm": 0.9},
            "rationale": "similar",
        }
    )

    with (
        patch.object(workflows.repo, "fetch_project_exists", new=AsyncMock(return_value=True)),
        patch.object(
            workflows.repo,
            "fetch_available_gemini_model",
            new=AsyncMock(return_value=True),
        ),
        patch.object(workflows.repo, "insert_run", new=AsyncMock(return_value=PROJECT_ID)),
        patch.object(
            workflows.repo,
            "fetch_sample_pdfs",
            new=AsyncMock(
                return_value=[SampledPdf(pdf_id=PDF_ID_1, name="doc.pdf", filepath="doc.pdf")]
            ),
        ),
        patch.object(workflows, "download_pdf_bytes", new=AsyncMock(return_value=(b"pdf", "doc.pdf"))),
        patch.object(
            workflows.ocr,
            "extract_evaluation_pages",
            new=AsyncMock(
                return_value=[
                    PageOcrText(
                        page_index=0,
                        pdfium_text="",
                        tesseract_text="Invoice 123 Total 45 " * 10,
                        olm_text="Invoice 123 Total 45 " * 10,
                    )
                ]
            ),
        ),
        patch.object(
            workflows,
            "call_google_genai",
            new=AsyncMock(return_value=LLMResponseData(judge_payload, 10, 5)),
        ),
        patch.object(
            workflows,
            "record_llm_usage",
            new=AsyncMock(return_value=Decimal("0.01")),
        ),
        patch.object(workflows.repo, "insert_page_evaluation", new=AsyncMock()) as insert_page,
        patch.object(workflows.repo, "complete_run", new=AsyncMock()) as complete_run,
    ):
        result = await workflows.evaluate_project_ocr_workflow(_make_pool_mock(conn), object(), cmd)

    assert result["recommendation"] == "tesseract"
    assert result["judge_model"] == "gemini-2.0-flash"
    insert_page.assert_awaited_once()
    complete_run.assert_awaited_once()


@pytest.mark.anyio
async def test_handler_creates_gemini_client_and_calls_workflow():
    conn = AsyncMock()
    cmd = EvaluateProjectOcr(project_id=PROJECT_ID, judge_model="gemini-2.0-flash")

    with (
        patch(
            "app.domains.ocr_evaluation.application.handlers.get_pool",
            new=AsyncMock(return_value=_make_pool_mock(conn)),
        ),
        patch("app.domains.ocr_evaluation.application.handlers.GeminiClient") as client_cls,
        patch(
            "app.domains.ocr_evaluation.application.handlers.evaluate_project_ocr_workflow",
            new=AsyncMock(return_value={"ok": True}),
        ) as workflow,
    ):
        result = await handle_evaluate_project_ocr(cmd)

    assert result == {"ok": True}
    client_cls.assert_called_once()
    workflow.assert_awaited_once()

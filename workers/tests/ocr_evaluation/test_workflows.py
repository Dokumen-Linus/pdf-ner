from contextlib import asynccontextmanager
from decimal import Decimal
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domains.ocr_evaluation.application import workflows
from app.domains.ocr_evaluation.application.commands import EvaluateProjectOcr
from app.domains.ocr_evaluation.application.handlers import handle_evaluate_project_ocr
from app.domains.ocr_evaluation.domain.entities import SampledPdf
from app.domains.text_extract.domain.entities import ExtractionResult, StoredPdfText
from app.shared.domain.LLMResponseData import LLMResponseData
from tests.conftest import PDF_ID_1, PDF_ID_2, PROJECT_ID


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
            "selected_ocr_usable": True,
            "confidence": 0.9,
            "quality_scores": {"tesseract": 0.9, "selected_ocr": 0.9},
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
        patch.object(
            workflows.repo,
            "fetch_extract_methods",
            new=AsyncMock(return_value=["deepseek-ocr", "olm-ocr2"]),
        ),
        patch.object(workflows.repo, "insert_run", new=AsyncMock(return_value=PROJECT_ID)),
        patch.object(
            workflows.repo,
            "fetch_sample_pdfs",
            new=AsyncMock(
                return_value=[SampledPdf(pdf_id=PDF_ID_1, name="doc.pdf", filepath="doc.pdf")]
            ),
        ),
        patch.object(
            workflows.repo,
            "fetch_pdf_text_by_extract_method",
            new=AsyncMock(return_value=None),
        ),
        patch.object(
            workflows,
            "extract_exact_text",
            new=AsyncMock(
                side_effect=lambda _conn, pdf_id, extract_method, created_by_domain: (
                    ExtractionResult(
                        pdf_id=pdf_id,
                        full_text=(
                            "" if extract_method == "pdfium" else "Invoice 123 Total 45 " * 10
                        ),
                        text_by_page={
                            "pages": [
                                {
                                    "page_index": 0,
                                    "text": (
                                        ""
                                        if extract_method == "pdfium"
                                        else "Invoice 123 Total 45 " * 10
                                    ),
                                }
                            ]
                        },
                        extract_method=extract_method,
                        pdf_txt_id=1,
                    )
                )
            ),
        ) as extract_text,
        patch.object(workflows.repo, "insert_run_pdf_text", new=AsyncMock()) as link_text,
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
    assert result["gpu_model"] == "olm-ocr2"
    assert result["ocr_only"] is True
    assert extract_text.await_count == 3
    assert link_text.await_count == 3
    insert_page.assert_awaited_once()
    complete_run.assert_awaited_once()


@pytest.mark.anyio
async def test_workflow_with_explicit_pdf_ids_uses_those_pdfs():
    conn = AsyncMock()
    cmd = EvaluateProjectOcr(
        project_id=PROJECT_ID,
        judge_model="gemini-2.0-flash",
        pdf_ids=[PDF_ID_2],
    )

    with (
        patch.object(workflows.repo, "fetch_project_exists", new=AsyncMock(return_value=True)),
        patch.object(
            workflows.repo,
            "fetch_available_gemini_model",
            new=AsyncMock(return_value=True),
        ),
        patch.object(
            workflows.repo,
            "fetch_extract_methods",
            new=AsyncMock(return_value=["deepseek-ocr", "olm-ocr2"]),
        ),
        patch.object(workflows.repo, "insert_run", new=AsyncMock(return_value=PROJECT_ID)),
        patch.object(workflows.repo, "fetch_sample_pdfs", new=AsyncMock()) as sample_pdfs,
        patch.object(
            workflows.repo,
            "fetch_project_pdfs_by_ids",
            new=AsyncMock(
                return_value=[SampledPdf(pdf_id=PDF_ID_2, name="doc.pdf", filepath="doc.pdf")]
            ),
        ) as explicit_pdfs,
        patch.object(
            workflows.repo,
            "fetch_pdf_text_by_extract_method",
            new=AsyncMock(return_value=None),
        ),
        patch.object(
            workflows,
            "extract_exact_text",
            new=AsyncMock(
                return_value=ExtractionResult(
                    pdf_id=PDF_ID_2,
                    full_text="embedded text " * 10,
                    text_by_page={"pages": [{"page_index": 0, "text": "embedded text " * 10}]},
                    extract_method="pdfium",
                    pdf_txt_id=1,
                )
            ),
        ),
        patch.object(workflows.repo, "insert_run_pdf_text", new=AsyncMock()),
        patch.object(workflows.repo, "insert_page_evaluation", new=AsyncMock()),
        patch.object(workflows.repo, "complete_run", new=AsyncMock()),
    ):
        result = await workflows.evaluate_project_ocr_workflow(_make_pool_mock(conn), object(), cmd)

    assert result["sampled_pdf_count"] == 1
    sample_pdfs.assert_not_awaited()
    explicit_pdfs.assert_awaited_once()


@pytest.mark.anyio
async def test_workflow_still_collects_ocr_candidates_when_pdfium_text_is_usable():
    conn = AsyncMock()
    cmd = EvaluateProjectOcr(
        project_id=PROJECT_ID,
        judge_model="gemini-2.0-flash",
        max_pdfs=1,
        max_pages_per_pdf=1,
        gpu_model="deepseek-ocr",
        ocr_only=True,
    )

    def extraction_result(pdf_id, extract_method: str) -> ExtractionResult:
        text = (
            "embedded text " * 10 if extract_method == "pdfium" else f"{extract_method} text " * 10
        )
        return ExtractionResult(
            pdf_id=pdf_id,
            full_text=text,
            text_by_page={"pages": [{"page_index": 0, "text": text}]},
            extract_method=extract_method,
            pdf_txt_id=1,
        )

    with (
        patch.object(workflows.repo, "fetch_project_exists", new=AsyncMock(return_value=True)),
        patch.object(
            workflows.repo,
            "fetch_available_gemini_model",
            new=AsyncMock(return_value=True),
        ),
        patch.object(
            workflows.repo,
            "fetch_extract_methods",
            new=AsyncMock(return_value=["deepseek-ocr", "olm-ocr2"]),
        ),
        patch.object(workflows.repo, "insert_run", new=AsyncMock(return_value=PROJECT_ID)),
        patch.object(
            workflows.repo,
            "fetch_sample_pdfs",
            new=AsyncMock(
                return_value=[SampledPdf(pdf_id=PDF_ID_1, name="doc.pdf", filepath="doc.pdf")]
            ),
        ),
        patch.object(
            workflows.repo,
            "fetch_pdf_text_by_extract_method",
            new=AsyncMock(return_value=None),
        ),
        patch.object(
            workflows,
            "extract_exact_text",
            new=AsyncMock(
                side_effect=lambda _conn, pdf_id, extract_method, created_by_domain: (
                    extraction_result(pdf_id, extract_method)
                )
            ),
        ) as extract_text,
        patch.object(workflows.repo, "insert_run_pdf_text", new=AsyncMock()),
        patch.object(workflows.repo, "insert_page_evaluation", new=AsyncMock()),
        patch.object(workflows.repo, "complete_run", new=AsyncMock()),
    ):
        await workflows.evaluate_project_ocr_workflow(_make_pool_mock(conn), object(), cmd)

    extracted_methods = [call.kwargs["extract_method"] for call in extract_text.await_args_list]
    assert extracted_methods[0] == "pdfium"
    assert set(extracted_methods[1:]) == {"deepseek-ocr", "tesseract"}


@pytest.mark.anyio
async def test_workflow_uses_saved_pdfium_text_and_still_judges_ocr_candidates():
    conn = AsyncMock()
    cmd = EvaluateProjectOcr(
        project_id=PROJECT_ID,
        judge_model="gemini-2.0-flash",
        max_pdfs=1,
        max_pages_per_pdf=1,
        gpu_model="deepseek-ocr",
        ocr_only=True,
    )
    judge_payload = json.dumps(
        {
            "best_method": "deepseek-ocr",
            "tesseract_usable": True,
            "selected_ocr_usable": True,
            "confidence": 0.8,
            "quality_scores": {"tesseract": 0.7, "selected_ocr": 0.8},
            "rationale": "selected OCR has fewer errors",
        }
    )

    def extraction_result(pdf_id, extract_method: str) -> ExtractionResult:
        text = f"{extract_method} text " * 10
        return ExtractionResult(
            pdf_id=pdf_id,
            full_text=text,
            text_by_page={"pages": [{"page_index": 0, "text": text}]},
            extract_method=extract_method,
            pdf_txt_id=1,
        )

    saved_pdfium = StoredPdfText(
        pdf_txt_id=1,
        pdf_id=PDF_ID_1,
        full_text="saved pdfium text " * 10,
        extract_method="pdfium",
        text_by_page={"pages": [{"page_index": 0, "text": "saved pdfium text " * 10}]},
    )

    with (
        patch.object(workflows.repo, "fetch_project_exists", new=AsyncMock(return_value=True)),
        patch.object(
            workflows.repo,
            "fetch_available_gemini_model",
            new=AsyncMock(return_value=True),
        ),
        patch.object(
            workflows.repo,
            "fetch_extract_methods",
            new=AsyncMock(return_value=["deepseek-ocr", "olm-ocr2"]),
        ),
        patch.object(workflows.repo, "insert_run", new=AsyncMock(return_value=PROJECT_ID)),
        patch.object(
            workflows.repo,
            "fetch_sample_pdfs",
            new=AsyncMock(
                return_value=[SampledPdf(pdf_id=PDF_ID_1, name="doc.pdf", filepath="doc.pdf")]
            ),
        ),
        patch.object(
            workflows.repo,
            "fetch_pdf_text_by_extract_method",
            new=AsyncMock(return_value=saved_pdfium),
        ) as fetch_saved_text,
        patch.object(
            workflows,
            "extract_exact_text",
            new=AsyncMock(
                side_effect=lambda _conn, pdf_id, extract_method, created_by_domain: (
                    extraction_result(pdf_id, extract_method)
                )
            ),
        ) as extract_text,
        patch.object(workflows.repo, "insert_run_pdf_text", new=AsyncMock()),
        patch.object(
            workflows,
            "call_google_genai",
            new=AsyncMock(return_value=LLMResponseData(judge_payload, 10, 5)),
        ) as judge,
        patch.object(
            workflows,
            "record_llm_usage",
            new=AsyncMock(return_value=Decimal("0.01")),
        ),
        patch.object(workflows.repo, "insert_page_evaluation", new=AsyncMock()) as insert_page,
        patch.object(workflows.repo, "complete_run", new=AsyncMock()),
    ):
        await workflows.evaluate_project_ocr_workflow(_make_pool_mock(conn), object(), cmd)

    fetch_saved_text.assert_awaited_once()
    extracted_methods = [call.kwargs["extract_method"] for call in extract_text.await_args_list]
    assert "pdfium" not in extracted_methods
    assert set(extracted_methods) == {"deepseek-ocr", "tesseract"}
    judge.assert_awaited_once()
    evaluation = insert_page.await_args.kwargs["evaluation"]
    assert evaluation.pdfium_text == "saved pdfium text " * 10
    assert evaluation.judge_result is not None
    assert evaluation.recommended_method == "pdfium"


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

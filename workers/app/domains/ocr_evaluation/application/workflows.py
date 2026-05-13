from __future__ import annotations

from decimal import Decimal
import logging
from typing import Any

import asyncpg

from app.domains.llm_usage.infrastructure.repository import record_llm_usage
from app.domains.text_extract.application.use_cases import extract_exact_text
from app.domains.text_extract.domain.entities import ExtractionResult, StoredPdfText
from app.domains.text_extract.domain.value_objects import (
    has_usable_text,
    join_page_text,
    pages_from_text_by_page,
)
from app.integrations.gemini import call_google_genai
from app.shared.domain.LLMResponseData import LLMResponseData

from ..domain import services
from ..domain.entities import PageEvaluation, PageOcrText
from ..infrastructure import repositories as repo
from .commands import EvaluateProjectOcr

logger = logging.getLogger(__name__)

_TASK_NAME = "ocr_evaluation.evaluate_project"


def _report_progress(
    task: Any | None,
    phase: str,
    message: str,
    percent: int,
    **details: Any,
) -> None:
    if task is None:
        return
    task.update_state(
        state="PROGRESS",
        meta={"phase": phase, "message": message, "percent": percent, "details": details},
    )


async def evaluate_project_ocr_workflow(
    pool: Any,
    gemini_client: Any,
    cmd: EvaluateProjectOcr,
    task: Any | None = None,
) -> dict:
    async with pool.acquire() as conn:
        if not await repo.fetch_project_exists(conn, cmd.project_id):
            raise ValueError(f"Project not found: {cmd.project_id}")
        if not await repo.fetch_available_gemini_model(conn, cmd.judge_model):
            raise ValueError(f"Judge model must be an available Gemini model: {cmd.judge_model}")
        gpu_model = cmd.gpu_model
        gpu_models = await repo.fetch_extract_methods(conn, method_type="gpu")
        if gpu_model not in gpu_models:
            raise ValueError(
                f"gpu_model must be a valid GPU OCR model ({', '.join(gpu_models)}), got {gpu_model!r}"
            )

        run_id = await repo.insert_run(
            conn,
            project_id=cmd.project_id,
            judge_model=cmd.judge_model,
            max_pdfs=cmd.max_pdfs,
            max_pages_per_pdf=cmd.max_pages_per_pdf,
            gpu_model=gpu_model,
            ocr_only=cmd.ocr_only,
        )

    try:
        return await _evaluate_project_ocr_run(
            pool,
            gemini_client,
            cmd,
            run_id,
            gpu_model,
            task,
        )
    except Exception as exc:
        async with pool.acquire() as conn:
            await repo.fail_run(
                conn,
                run_id=run_id,
                error_type=type(exc).__name__,
                error_message=str(exc),
            )
        raise


async def _evaluate_project_ocr_run(
    pool: Any,
    gemini_client: Any,
    cmd: EvaluateProjectOcr,
    run_id,
    gpu_model: str,
    task: Any | None,
) -> dict:
    async with pool.acquire() as conn:
        if cmd.pdf_ids is None:
            sampled_pdfs = await repo.fetch_sample_pdfs(conn, cmd.project_id, cmd.max_pdfs)
        else:
            sampled_pdfs = await repo.fetch_project_pdfs_by_ids(
                conn,
                cmd.project_id,
                cmd.pdf_ids,
            )
            found_pdf_ids = {pdf.pdf_id for pdf in sampled_pdfs}
            missing_pdf_ids = [pdf_id for pdf_id in cmd.pdf_ids if pdf_id not in found_pdf_ids]
            if missing_pdf_ids:
                raise ValueError("One or more PDFs do not belong to the project")
    if not sampled_pdfs:
        raise ValueError(f"No PDFs found for project: {cmd.project_id}")

    _report_progress(
        task,
        "sampling",
        f"Loaded {len(sampled_pdfs)} PDFs for OCR evaluation",
        5,
        pdfs=len(sampled_pdfs),
    )

    evaluations: list[PageEvaluation] = []
    input_tokens = 0
    output_tokens = 0
    spent_cost = Decimal("0")

    for pdf_index, pdf in enumerate(sampled_pdfs):
        try:
            text_by_method = {}
            async with pool.acquire() as conn:
                pdfium_result = await _get_pdfium_text(
                    conn,
                    pdf_id=pdf.pdf_id,
                )
                pdfium_pages = pages_from_text_by_page(pdfium_result.text_by_page)
                text_by_method["pdfium"] = {page.page_index: page.text for page in pdfium_pages}
                if pdfium_result.pdf_txt_id is not None:
                    await repo.insert_run_pdf_text(
                        conn,
                        run_id=run_id,
                        pdf_id=pdf.pdf_id,
                        method="pdfium",
                        pdf_txt_id=pdfium_result.pdf_txt_id,
                    )

                if cmd.ocr_only or not has_usable_text(join_page_text(pdfium_pages)):
                    for method in {"tesseract", gpu_model} - {"pdfium"}:
                        result = await extract_exact_text(
                            conn,
                            pdf_id=pdf.pdf_id,
                            extract_method=method,
                            created_by_domain="ocr_evaluation",
                        )
                        text_by_method[method] = {
                            page.page_index: page.text
                            for page in pages_from_text_by_page(result.text_by_page)
                        }
                        if result.pdf_txt_id is not None:
                            await repo.insert_run_pdf_text(
                                conn,
                                run_id=run_id,
                                pdf_id=pdf.pdf_id,
                                method=method,
                                pdf_txt_id=result.pdf_txt_id,
                            )

            selected_ocr_method = gpu_model if gpu_model != "pdfium" else "tesseract"
            pages = _evaluation_pages_from_texts(
                text_by_method,
                requested_page_count=cmd.max_pages_per_pdf,
                selected_ocr_method=selected_ocr_method,
            )

            _report_progress(
                task,
                "ocr",
                f"Evaluated OCR candidates for PDF {pdf_index + 1}/{len(sampled_pdfs)}",
                min(65, 10 + int(((pdf_index + 1) / len(sampled_pdfs)) * 45)),
                pdf_id=str(pdf.pdf_id),
                pages=len(pages),
            )

            for page in pages:
                async with pool.acquire() as conn:
                    evaluation, usage, cost = await _evaluate_page(
                        conn,
                        gemini_client,
                        cmd,
                        pdf.pdf_id,
                        page,
                        spent_cost,
                    )
                    input_tokens += usage.input_tokens if usage is not None else 0
                    output_tokens += usage.output_tokens if usage is not None else 0
                    spent_cost += cost
                    evaluations.append(evaluation)
                    await repo.insert_page_evaluation(conn, run_id=run_id, evaluation=evaluation)

        except Exception as exc:
            logger.warning("Failed to process pdf=%s: %s", pdf.pdf_id, exc, exc_info=True)

            # Record a failed page evaluation so the error is tracked
            evaluation = PageEvaluation(
                pdf_id=pdf.pdf_id,
                page_index=0,
                pdfium_text="",
                tesseract_text="",
                selected_ocr_text=None,
                selected_ocr_method=gpu_model if gpu_model != "pdfium" else "tesseract",
                similarity=services.score_tesseract_against_selected("", None),
                judge_result=None,
                recommended_method="manual_review",
                error_message=f"{type(exc).__name__}: {exc}",
            )
            evaluations.append(evaluation)
            async with pool.acquire() as conn:
                await repo.insert_page_evaluation(conn, run_id=run_id, evaluation=evaluation)
            continue

    summary = services.summarize_evaluations(
        evaluations,
        sampled_pdf_count=len(sampled_pdfs),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=spent_cost,
    )
    async with pool.acquire() as conn:
        await repo.complete_run(conn, run_id=run_id, summary=summary)

    _report_progress(
        task,
        "complete",
        "OCR evaluation complete",
        100,
        recommendation=summary.recommendation,
        confidence=summary.confidence,
    )

    return {
        "run_id": str(run_id),
        "project_id": str(cmd.project_id),
        "recommendation": summary.recommendation,
        "confidence": summary.confidence,
        "sampled_pdf_count": summary.sampled_pdf_count,
        "sampled_page_count": summary.sampled_page_count,
        "judge_model": cmd.judge_model,
        "gpu_model": gpu_model,
        "ocr_only": cmd.ocr_only,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": str(spent_cost),
    }


async def _evaluate_page(
    conn: asyncpg.Connection,
    gemini_client: Any,
    cmd: EvaluateProjectOcr,
    pdf_id,
    page: PageOcrText,
    spent_cost: Decimal,
) -> tuple[PageEvaluation, LLMResponseData | None, Decimal]:
    similarity = services.score_tesseract_against_selected(
        page.tesseract_text,
        page.selected_ocr_text,
    )
    judge_result = None
    usage = None
    cost = Decimal("0")

    if spent_cost < cmd.max_cost_usd:
        try:
            system_prompt, user_prompt = services.build_judge_prompt(page, similarity)
            usage = await call_google_genai(
                gemini_client,
                cmd.judge_model,
                system_prompt,
                user_prompt,
                json_response=True,
            )
            cost = await record_llm_usage(
                conn,
                model=cmd.judge_model,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                project_id=cmd.project_id,
                task_name=_TASK_NAME,
            )
            judge_result = services.parse_judge_result(usage.text, page.selected_ocr_method)
        except Exception as exc:
            logger.warning(
                "OCR judge failed for pdf=%s page=%s: %s",
                pdf_id,
                page.page_index,
                exc,
                exc_info=True,
            )

    recommended_method = services.recommend_page_method(
        page.pdfium_text,
        similarity,
        judge_result,
        page.selected_ocr_method,
    )
    return (
        PageEvaluation(
            pdf_id=pdf_id,
            page_index=page.page_index,
            pdfium_text=page.pdfium_text,
            tesseract_text=page.tesseract_text,
            selected_ocr_text=page.selected_ocr_text,
            selected_ocr_method=page.selected_ocr_method,
            similarity=similarity,
            judge_result=judge_result,
            recommended_method=recommended_method,
            error_message=page.error_message,
        ),
        usage,
        cost,
    )


async def _get_pdfium_text(conn: asyncpg.Connection, *, pdf_id) -> ExtractionResult:
    stored = await repo.fetch_pdf_text_by_extract_method(
        conn,
        pdf_id=pdf_id,
        extract_method="pdfium",
    )
    if stored is not None:
        return _extraction_result_from_stored_text(stored)
    return await extract_exact_text(
        conn,
        pdf_id=pdf_id,
        extract_method="pdfium",
        created_by_domain="ocr_evaluation",
    )


def _extraction_result_from_stored_text(stored: StoredPdfText) -> ExtractionResult:
    return ExtractionResult(
        pdf_id=stored.pdf_id,
        full_text=stored.full_text,
        text_by_page=stored.text_by_page
        or {"pages": [{"page_index": 0, "text": stored.full_text}]},
        extract_method=stored.extract_method,
        pdf_txt_id=stored.pdf_txt_id,
    )


def _evaluation_pages_from_texts(
    text_by_method: dict[str, dict[int, str]],
    *,
    requested_page_count: int,
    selected_ocr_method: str,
) -> list[PageOcrText]:
    all_page_indexes = sorted(
        {page_index for pages in text_by_method.values() for page_index in pages.keys()}
    )
    if not all_page_indexes:
        return []
    sampled_indexes = _sample_page_indexes(all_page_indexes, requested_page_count)
    return [
        PageOcrText(
            page_index=page_index,
            pdfium_text=text_by_method.get("pdfium", {}).get(page_index, ""),
            tesseract_text=text_by_method.get("tesseract", {}).get(page_index, ""),
            selected_ocr_text=text_by_method.get(selected_ocr_method, {}).get(page_index),
            selected_ocr_method=selected_ocr_method,
        )
        for page_index in sampled_indexes
    ]


def _sample_page_indexes(page_indexes: list[int] | int, requested_page_count: int) -> list[int]:
    if isinstance(page_indexes, int):
        page_indexes = list(range(page_indexes))
    if not page_indexes:
        return []
    if len(page_indexes) <= requested_page_count:
        return page_indexes
    if requested_page_count == 1:
        return [page_indexes[0]]
    if requested_page_count == 2:
        return [page_indexes[0], page_indexes[-1]]

    candidates = {page_indexes[0], page_indexes[len(page_indexes) // 2], page_indexes[-1]}
    if requested_page_count > 3:
        step = max(len(page_indexes) // requested_page_count, 1)
        for page_index in page_indexes[::step]:
            if len(candidates) >= requested_page_count:
                break
            candidates.add(page_index)
    return sorted(candidates)

from __future__ import annotations

from decimal import Decimal
import logging
from typing import Any

import asyncpg

from app.domains.billing.infrastructure.repository import record_llm_usage
from app.integrations.gemini import call_google_genai
from app.shared.domain.LLMResponseData import LLMResponseData
from app.shared.infrastructure.s3 import download_pdf_bytes

from ..domain import services
from ..domain.entities import PageEvaluation, PageOcrText
from ..infrastructure import ocr
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

        run_id = await repo.insert_run(
            conn,
            project_id=cmd.project_id,
            judge_model=cmd.judge_model,
            max_pdfs=cmd.max_pdfs,
            max_pages_per_pdf=cmd.max_pages_per_pdf,
        )

    try:
        return await _evaluate_project_ocr_run(pool, gemini_client, cmd, run_id, task)
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
    task: Any | None,
) -> dict:
    async with pool.acquire() as conn:
        sampled_pdfs = await repo.fetch_sample_pdfs(conn, cmd.project_id, cmd.max_pdfs)
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
            async with pool.acquire() as conn:
                pdf_bytes, _filepath = await download_pdf_bytes(conn, pdf.pdf_id)
            pages = await ocr.extract_evaluation_pages(pdf_bytes, cmd.max_pages_per_pdf)

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
                olm_text=None,
                similarity=services.score_tesseract_against_olm("", None),
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
    similarity = services.score_tesseract_against_olm(page.tesseract_text, page.olm_text)
    judge_result = None
    usage = None
    cost = Decimal("0")

    if spent_cost < cmd.max_cost_usd and not services.is_pdfium_usable(page.pdfium_text):
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
            judge_result = services.parse_judge_result(usage.text)
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
    )
    return (
        PageEvaluation(
            pdf_id=pdf_id,
            page_index=page.page_index,
            pdfium_text=page.pdfium_text,
            tesseract_text=page.tesseract_text,
            olm_text=page.olm_text,
            similarity=similarity,
            judge_result=judge_result,
            recommended_method=recommended_method,
            error_message=page.error_message,
        ),
        usage,
        cost,
    )

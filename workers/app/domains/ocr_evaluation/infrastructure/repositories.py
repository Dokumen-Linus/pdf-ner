from __future__ import annotations

from decimal import Decimal
import json
from uuid import UUID

import asyncpg

from app.domains.text_extract.domain.entities import StoredPdfText

from ..domain.entities import EvaluationSummary, PageEvaluation, SampledPdf
from ..domain.services import judge_result_payload, similarity_metrics_payload


async def fetch_project_exists(conn: asyncpg.Connection, project_id: UUID) -> bool:
    return bool(await conn.fetchval("SELECT 1 FROM web.projects WHERE id = $1", project_id))


async def fetch_available_gemini_model(conn: asyncpg.Connection, model_id: str) -> bool:
    row = await conn.fetchrow(
        """
        SELECT id
        FROM public.chat_models
        WHERE id = $1
          AND host = 'Google'
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model_id,
    )
    return row is not None


async def fetch_extract_methods(
    conn: asyncpg.Connection,
    method_type: str | None = None,
) -> list[str]:
    if method_type is not None:
        rows = await conn.fetch(
            "SELECT id FROM public.extract_methods WHERE method_type = $1 ORDER BY id",
            method_type,
        )
    else:
        rows = await conn.fetch("SELECT id FROM public.extract_methods ORDER BY id")
    return [row["id"] for row in rows]


async def fetch_sample_pdfs(
    conn: asyncpg.Connection,
    project_id: UUID,
    limit: int,
) -> list[SampledPdf]:
    rows = await conn.fetch(
        """
        SELECT id, filepath
        FROM core.pdfs
        WHERE project_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
        """,
        project_id,
        limit,
    )
    return [
        SampledPdf(
            pdf_id=row["id"],
            name=None,
            filepath=row["filepath"],
        )
        for row in rows
    ]


async def fetch_project_pdfs_by_ids(
    conn: asyncpg.Connection,
    project_id: UUID,
    pdf_ids: list[UUID],
) -> list[SampledPdf]:
    rows = await conn.fetch(
        """
        SELECT id, filepath
        FROM core.pdfs
        WHERE project_id = $1
          AND id = ANY($2::uuid[])
        ORDER BY array_position($2::uuid[], id)
        """,
        project_id,
        pdf_ids,
    )
    return [
        SampledPdf(
            pdf_id=row["id"],
            name=None,
            filepath=row["filepath"],
        )
        for row in rows
    ]


async def fetch_pdf_text_by_extract_method(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    extract_method: str,
) -> StoredPdfText | None:
    row = await conn.fetchrow(
        """
        SELECT id, pdf_id, txt, extract_method, text_by_page
        FROM workers.pdf_txts
        WHERE pdf_id = $1
          AND extract_method = $2
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        pdf_id,
        extract_method,
    )
    if row is None:
        return None
    return StoredPdfText(
        pdf_txt_id=row["id"],
        pdf_id=row["pdf_id"],
        full_text=row["txt"],
        extract_method=row["extract_method"],
        text_by_page=row["text_by_page"],
    )


async def insert_run(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    judge_model: str,
    max_pdfs: int,
    max_pages_per_pdf: int,
    gpu_model: str,
    ocr_only: bool,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO workers.ocr_evaluation_runs
            (project_id, status, judge_model, max_pdfs, max_pages_per_pdf, extract_method, ocr_only)
        VALUES ($1, 'running', $2, $3, $4, $5, $6)
        RETURNING id
        """,
        project_id,
        judge_model,
        max_pdfs,
        max_pages_per_pdf,
        gpu_model,
        ocr_only,
    )


async def insert_run_pdf_text(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    pdf_id: UUID,
    method: str,
    pdf_txt_id: int,
) -> None:
    await conn.execute(
        """
        INSERT INTO workers.ocr_evaluation_pdf_txts
            (run_id, pdf_id, extract_method, pdf_txt_id)
        VALUES ($1, $2, $3, $4)
        """,
        run_id,
        pdf_id,
        method,
        pdf_txt_id,
    )


async def insert_page_evaluation(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    evaluation: PageEvaluation,
) -> None:
    await conn.execute(
        """
        INSERT INTO workers.ocr_evaluation_pages
            (run_id, pdf_id, page_index, deterministic_metrics, judge_result,
             recommended_method, error_message)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
        """,
        run_id,
        evaluation.pdf_id,
        evaluation.page_index,
        json.dumps(similarity_metrics_payload(evaluation.similarity)),
        json.dumps(judge_result_payload(evaluation.judge_result))
        if evaluation.judge_result is not None
        else None,
        evaluation.recommended_method,
        evaluation.error_message,
    )


async def complete_run(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    summary: EvaluationSummary,
) -> None:
    await conn.execute(
        """
        UPDATE workers.ocr_evaluation_runs
        SET status = 'succeeded',
            sampled_pdf_count = $2,
            sampled_page_count = $3,
            recommendation = $4,
            confidence = $5,
            summary = $6::jsonb,
            input_tokens = $7,
            output_tokens = $8,
            cost_usd = $9,
            finished_at = now()
        WHERE id = $1
        """,
        run_id,
        summary.sampled_pdf_count,
        summary.sampled_page_count,
        summary.recommendation,
        summary.confidence,
        json.dumps(_summary_payload(summary)),
        summary.input_tokens,
        summary.output_tokens,
        summary.cost_usd,
    )


async def fail_run(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    error_type: str,
    error_message: str,
) -> None:
    await conn.execute(
        """
        UPDATE workers.ocr_evaluation_runs
        SET status = 'failed',
            error_type = $2,
            error_message = $3,
            finished_at = now()
        WHERE id = $1
        """,
        run_id,
        error_type,
        error_message,
    )


def _summary_payload(summary: EvaluationSummary) -> dict:
    return {
        "recommendation": summary.recommendation,
        "confidence": summary.confidence,
        "sampled_pdf_count": summary.sampled_pdf_count,
        "sampled_page_count": summary.sampled_page_count,
        "pdfium_usable_page_ratio": summary.pdfium_usable_page_ratio,
        "average_tesseract_vs_olm_score": summary.average_tesseract_vs_olm_score,
        "average_judge_confidence": summary.average_judge_confidence,
        "input_tokens": summary.input_tokens,
        "output_tokens": summary.output_tokens,
        "cost_usd": str(Decimal(summary.cost_usd)),
        "details": summary.details,
    }

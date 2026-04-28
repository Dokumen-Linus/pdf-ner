import json
import logging
from uuid import UUID

import asyncpg

from ..domain.entities import EntityTypeInfo, FinalPredictionPair, LabeledAnnotation, LabeledPdf

logger = logging.getLogger(__name__)


async def fetch_project(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT id, name, description FROM web.projects WHERE id = $1",
        project_id,
    )


async def fetch_model_provider(conn: asyncpg.Connection, model_id: str) -> str | None:
    row = await conn.fetchrow(
        """
        SELECT provider
        FROM public.models
        WHERE id = $1
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model_id,
    )
    return row["provider"] if row else None


async def fetch_entity_types_with_std(
    conn: asyncpg.Connection, project_id: UUID
) -> list[EntityTypeInfo]:
    """Fetch entity types joined with their standard definitions."""
    rows = await conn.fetch(
        """
        SELECT
            et.id AS entity_type_id,
            et.name,
            et.user_definition,
            et.user_examples,
            et.user_format_description,
            et.datatype,
            et.single_word,
            et.exact_length,
            et."unique",
            et.required,
            s.definition        AS std_definition,
            s.examples          AS std_examples,
            s.format_description AS std_format_description,
            s.regex             AS std_regex
        FROM web.entity_types et
        LEFT JOIN public.std_entity_types s ON et.standard_entity_type_id = s.id
        WHERE et.project_id = $1
        ORDER BY et.created_at
        """,
        project_id,
    )
    return [
        EntityTypeInfo(
            name=r["name"],
            user_definition=r["user_definition"],
            user_examples=r["user_examples"] or [],
            user_format_description=r["user_format_description"],
            datatype=r["datatype"],
            single_word=r["single_word"],
            exact_length=r["exact_length"],
            unique=r["unique"],
            required=r["required"],
            std_definition=r["std_definition"],
            std_examples=r["std_examples"] or [],
            std_format_description=r["std_format_description"],
            std_regex=r["std_regex"],
            entity_type_id=r["entity_type_id"] if "entity_type_id" in r else None,
        )
        for r in rows
    ]


async def fetch_labeled_pdfs(conn: asyncpg.Connection, project_id: UUID) -> list[LabeledPdf]:
    """Fetch PDFs that are present in web.annotations with their labels and saved text."""
    pdf_rows = await conn.fetch(
        """
        SELECT p.id, p.full_text, p.text_by_page, p.bucket_id, p.filepath
        FROM workers.pdfs p
        WHERE p.project_id = $1
          AND EXISTS (SELECT 1 FROM web.annotations a WHERE a.pdf_id = p.id)
        ORDER BY p.id
        """,
        project_id,
    )

    if not pdf_rows:
        return []

    pdf_ids = [r["id"] for r in pdf_rows]
    pdf_map = {r["id"]: r for r in pdf_rows}

    ann_rows = await conn.fetch(
        """
        SELECT
            a.pdf_id,
            a.entity_type_id,
            COALESCE(a.custom_entity_type, et.name) AS custom_entity_type,
            a.contents,
            a.page_index
        FROM web.annotations a
        JOIN web.entity_types et ON et.id = a.entity_type_id
        WHERE a.pdf_id = ANY($1)
          AND et.project_id = $2
        ORDER BY a.pdf_id, a.page_index, a.id
        """,
        pdf_ids,
        project_id,
    )

    anns_by_pdf: dict[UUID, list[LabeledAnnotation]] = {}
    for r in ann_rows:
        ann = LabeledAnnotation(
            pdf_id=r["pdf_id"],
            entity_type_name=r["custom_entity_type"],
            labeled_text=r["contents"] or "",
            page_index=r["page_index"],
            entity_type_id=r["entity_type_id"] if "entity_type_id" in r else None,
        )
        anns_by_pdf.setdefault(r["pdf_id"], []).append(ann)

    result = []
    for pdf_id, annotations in anns_by_pdf.items():
        pdf_row = pdf_map.get(pdf_id)
        if pdf_row:
            result.append(
                LabeledPdf(
                    pdf_id=pdf_id,
                    full_text=pdf_row["full_text"],
                    text_by_page=pdf_row["text_by_page"],
                    annotations=annotations,
                    bucket_id=UUID(str(pdf_row["bucket_id"])) if pdf_row["bucket_id"] else None,
                    filepath=pdf_row["filepath"],
                )
            )

    return result


async def insert_optimized_prompt(
    conn: asyncpg.Connection, project_id: UUID, full_text: str
) -> UUID:
    """Insert an optimized prompt into workers.optimized_prompts."""
    prompt_id = await conn.fetchval(
        """
        INSERT INTO workers.optimized_prompts (project_id, full_text)
        VALUES ($1, $2) RETURNING id
        """,
        project_id,
        full_text,
    )
    logger.info("Inserted optimized prompt: %s", prompt_id)
    return prompt_id


async def insert_evaluation(
    conn: asyncpg.Connection,
    prompt_id: UUID,
    overall_f1: float,
    per_entity_scores: dict,
    *,
    model_id: str | None = None,
    labeled_pdf_count: int | None = None,
    evaluated_pdf_count: int | None = None,
    skipped_pdf_count: int | None = None,
    pdfs_fully_correct: int | None = None,
    pdf_accuracy: float | None = None,
    entity_type_metrics: dict | None = None,
    llm_call_count: int | None = None,
    cost_usd=None,
    iterations_run: int | None = None,
    stop_reason: str | None = None,
) -> UUID:
    """Store evaluation results in workers.prompt_evaluations."""
    scores_json = json.dumps(
        {
            k: {"precision": v.precision, "recall": v.recall, "f1": v.f1}
            for k, v in per_entity_scores.items()
        }
    )
    evaluation_id = await conn.fetchval(
        """
        INSERT INTO workers.prompt_evaluations
            (prompt_id, overall_f1, per_entity_scores, model_id, labeled_pdf_count,
             evaluated_pdf_count, skipped_pdf_count, pdfs_fully_correct, pdf_accuracy,
             entity_type_metrics, llm_call_count, cost_usd, iterations_run, stop_reason)
        VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
        RETURNING id
        """,
        prompt_id,
        overall_f1,
        scores_json,
        model_id,
        labeled_pdf_count,
        evaluated_pdf_count,
        skipped_pdf_count,
        pdfs_fully_correct,
        pdf_accuracy,
        json.dumps(entity_type_metrics) if entity_type_metrics is not None else None,
        llm_call_count,
        cost_usd,
        iterations_run,
        stop_reason,
    )
    logger.info("Inserted evaluation for prompt %s: f1=%.4f", prompt_id, overall_f1)
    return evaluation_id


async def insert_context_engineering_predictions(
    conn: asyncpg.Connection,
    prompt_evaluation_id: UUID,
    pairs: list[FinalPredictionPair],
) -> None:
    if not pairs:
        return
    await conn.executemany(
        """
        INSERT INTO workers.context_eng_preds
            (prompt_evaluation_id, pdf_id, entity_type_id, labelled_value, predicted_value)
        VALUES ($1, $2, $3, $4, $5)
        """,
        [
            (
                prompt_evaluation_id,
                pair.pdf_id,
                pair.entity_type_id,
                pair.labelled_value,
                pair.predicted_value,
            )
            for pair in pairs
        ],
    )


async def update_pdf_final_predictions(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    optimized_prompt_id: UUID,
    model: str,
    predicted: dict,
) -> None:
    await conn.execute(
        """
        UPDATE workers.pdfs
        SET predicted_entities = $2::jsonb,
            model_type = 'LLM',
            model = $3,
            optimized_prompt_id = $4
        WHERE id = $1
        """,
        pdf_id,
        json.dumps(predicted),
        model,
        optimized_prompt_id,
    )

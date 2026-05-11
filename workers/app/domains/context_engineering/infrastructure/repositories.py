import json
import logging
from uuid import UUID

import asyncpg

from ..domain.entities import (
    EntityTypeInfo,
    FinalPredictionPair,
    LabeledAnnotation,
    LabeledPdf,
    PromptExampleSnapshot,
)

logger = logging.getLogger(__name__)


def _row_get(row, new_key: str, old_key: str | None = None, default=None):
    try:
        return row[new_key]
    except (KeyError, TypeError):
        if old_key is not None:
            try:
                return row[old_key]
            except (KeyError, TypeError):
                pass
        return default


async def fetch_project(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT id, name, description FROM web.projects WHERE id = $1",
        project_id,
    )


async def fetch_model_provider(conn: asyncpg.Connection, model_id: str) -> str | None:
    row = await conn.fetchrow(
        """
        SELECT CASE host
                   WHEN 'OpenAI' THEN 'openai'
                   WHEN 'Anthropic' THEN 'anthropic'
                   WHEN 'Google' THEN 'gemini'
                   ELSE lower(host)
               END AS provider
        FROM public.chat_models
        WHERE id = $1
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model_id,
    )
    return row["provider"] if row else None


async def fetch_template(conn: asyncpg.Connection, template_id: int) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT id, txt,
               includes_project_description,
               includes_entity_type_definitions,
               includes_entity_type_example_values,
               includes_entity_type_example_finds,
               includes_entity_type_regex
        FROM public.templates
        WHERE id = $1
        """,
        template_id,
    )


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
            et.user_example_values,
            et.user_format_description,
            et.datatype,
            false AS single_word,
            et.exact_length,
            et."unique",
            et.required,
            s.definition        AS std_definition,
            s.examples          AS std_examples,
            NULL AS std_format_description,
            COALESCE(et.regex, s.regex) AS std_regex
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
            user_examples=_row_get(r, "user_example_values", "user_examples", []) or [],
            user_format_description=r["user_format_description"],
            datatype=r["datatype"],
            single_word=_row_get(r, "single_word", default=False),
            exact_length=r["exact_length"],
            unique=r["unique"],
            required=r["required"],
            std_definition=r["std_definition"],
            std_examples=r["std_examples"] or [],
            std_format_description=r["std_format_description"],
            std_regex=r["std_regex"],
            entity_type_id=_row_get(r, "entity_type_id"),
        )
        for r in rows
    ]


async def fetch_labeled_pdfs(conn: asyncpg.Connection, project_id: UUID) -> list[LabeledPdf]:
    """Fetch PDFs that have user labels in core.entity_values and saved text."""
    pdf_rows = await conn.fetch(
        """
        SELECT p.id, txt.txt AS full_text, txt.text_by_page, pr.bucket_id, p.filepath
        FROM core.pdfs p
        JOIN web.projects pr ON pr.id = p.project_id
        LEFT JOIN LATERAL (
            SELECT txt, text_by_page
            FROM workers.pdf_txts
            WHERE pdf_id = p.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) txt ON true
        WHERE p.project_id = $1
          AND p.has_labels
          AND EXISTS (
              SELECT 1
              FROM core.entity_values ev
              WHERE ev.pdf_id = p.id AND ev.is_label
          )
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
            ev.pdf_id,
            ev.entity_type_id,
            et.name AS custom_entity_type,
            ev.text_value AS contents,
            ev.page_index
        FROM core.entity_values ev
        JOIN web.entity_types et ON et.id = ev.entity_type_id
        WHERE ev.pdf_id = ANY($1)
          AND ev.is_label
          AND et.project_id = $2
        ORDER BY ev.pdf_id, ev.page_index, ev.id
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
    conn: asyncpg.Connection, project_id: UUID, template_id: int, full_text: str
) -> UUID:
    """Insert an optimized prompt candidate into core.prompts."""
    prompt_id = await conn.fetchval(
        """
        INSERT INTO core.prompts (project_id, template_id, full_text)
        VALUES ($1, $2, $3) RETURNING id
        """,
        project_id,
        template_id,
        full_text,
    )
    logger.info("Inserted optimized prompt: %s", prompt_id)
    return prompt_id


async def insert_optimized_prompt_examples(
    conn: asyncpg.Connection,
    optimized_prompt_id: UUID,
    examples: list[PromptExampleSnapshot],
    entity_types: list[EntityTypeInfo] | None = None,
) -> None:
    if not examples:
        return
    if entity_types is None:
        await conn.executemany(
            """
            INSERT INTO workers.prompt_examples
                (prompt_id, pdf_id, entity_type_id, example_idx)
            VALUES ($1, $2, NULL, $3)
            """,
            [(optimized_prompt_id, example.pdf_id, example.example_order) for example in examples],
        )
        return
    entity_id_by_name = {entity.name: entity.entity_type_id for entity in entity_types}
    rows = []
    for example in examples:
        for entity_name in example.labelled_entities:
            entity_type_id = entity_id_by_name.get(entity_name)
            if entity_type_id is not None:
                rows.append(
                    (optimized_prompt_id, example.pdf_id, entity_type_id, example.example_order)
                )
    if not rows:
        return
    await conn.executemany(
        """
        INSERT INTO workers.prompt_examples
            (prompt_id, pdf_id, entity_type_id, example_idx)
        VALUES ($1, $2, $3, $4)
        """,
        rows,
    )


async def insert_context_engineering_run(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    beta: float,
    max_usd,
    labeled_pdfs: list[UUID],
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO workers.context_engineering_runs (project_id, beta, max_usd, labeled_pdfs)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        project_id,
        beta,
        max_usd,
        labeled_pdfs,
    )


async def insert_evaluation(
    conn: asyncpg.Connection,
    context_eng_run_id: UUID,
    prompt_id,
    overall_f1=None,
    per_entity_scores: dict | None = None,
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
    if per_entity_scores is None:
        per_entity_scores = overall_f1
        overall_f1 = prompt_id
        prompt_id = context_eng_run_id
        context_eng_run_id = await conn.fetchval(
            """
            INSERT INTO workers.context_engineering_runs
                (project_id, beta, max_usd, labeled_pdfs)
            VALUES (
                (SELECT project_id FROM core.prompts WHERE id = $1),
                1,
                1,
                ARRAY[]::uuid[]
            )
            RETURNING id
            """,
            prompt_id,
        )
    """Store final context-engineering iteration metrics."""
    scores_json = json.dumps(
        {
            k: {"precision": v.precision, "recall": v.recall, "f1": v.f1}
            for k, v in per_entity_scores.items()
        }
    )
    evaluation_id = await conn.fetchval(
        """
        INSERT INTO workers.context_engineering_iterations
            (context_eng_run_id, prompt_id, overall_f, per_entity_scores,
             num_example_pdfs, num_correct_pdfs, num_correct_entity_types, pdf_accuracy,
             entity_type_metrics)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb)
        RETURNING id
        """,
        context_eng_run_id,
        prompt_id,
        overall_f1,
        scores_json,
        None,
        pdfs_fully_correct,
        None,
        pdf_accuracy,
        json.dumps(entity_type_metrics) if entity_type_metrics is not None else None,
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
        INSERT INTO core.entity_values
            (pdf_id, entity_type_id, text_value, is_label)
        VALUES ($1, $2, $3, false)
        """,
        [
            (
                pair.pdf_id,
                pair.entity_type_id,
                pair.predicted_value,
            )
            for pair in pairs
            if pair.predicted_value
        ],
    )


async def update_pdf_final_predictions(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    optimized_prompt_id: UUID,
) -> UUID:
    ner_run_id = await conn.fetchval(
        """
        INSERT INTO workers.ner_runs (project_id, prompt_id, context_eng_iter_id)
        SELECT p.project_id, $2, NULL
        FROM core.pdfs p
        WHERE p.id = $1
        RETURNING id
        """,
        pdf_id,
        optimized_prompt_id,
    )
    await conn.execute(
        """
        INSERT INTO workers.ner_run_pdfs (pdf_id, ner_run_id)
        VALUES ($1, $2)
        """,
        pdf_id,
        ner_run_id,
    )
    return ner_run_id


async def complete_context_engineering_run(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    best_prompt_id: UUID,
    best_overall_f: float,
    accumulated_usd,
    stop_reason: str,
) -> None:
    await conn.execute(
        """
        UPDATE workers.context_engineering_runs
        SET best_prompt_id = $2,
            best_overall_f = $3,
            accumulated_usd = $4,
            stop_reason = $5
        WHERE id = $1
        """,
        run_id,
        best_prompt_id,
        best_overall_f,
        accumulated_usd,
        stop_reason,
    )
    await conn.execute(
        """
        UPDATE web.projects
        SET active_prompt_id = $2
        WHERE id = (
            SELECT project_id
            FROM workers.context_engineering_runs
            WHERE id = $1
        )
        """,
        run_id,
        best_prompt_id,
    )

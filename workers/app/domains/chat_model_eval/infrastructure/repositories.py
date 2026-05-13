from __future__ import annotations

import json
from typing import cast
from uuid import UUID

import asyncpg

from app.domains.ner_runs.domain.entities import EntityTypeInfo, NerPdfInput

from ..domain.entities import ModelMetadata, ProjectModelEvalConfig


async def fetch_project_config(
    conn: asyncpg.Connection,
    project_id: UUID,
) -> ProjectModelEvalConfig | None:
    row = await conn.fetchrow(
        """
        SELECT id, active_prompt_id
        FROM web.projects
        WHERE id = $1
          AND active_prompt_id IS NOT NULL
        """,
        project_id,
    )
    if row is None:
        return None
    return ProjectModelEvalConfig(
        project_id=cast(UUID, row["id"]), active_prompt_id=cast(UUID, row["active_prompt_id"])
    )


async def fetch_prompt_text(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    prompt_id: UUID,
) -> str | None:
    return await conn.fetchval(
        """
        SELECT full_text
        FROM core.prompts
        WHERE id = $1
          AND project_id = $2
          AND full_text IS NOT NULL
        """,
        prompt_id,
        project_id,
    )


async def fetch_available_model_metadata(
    conn: asyncpg.Connection,
    model_ids: list[str],
) -> dict[str, ModelMetadata]:
    if not model_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT id,
               CASE host
                   WHEN 'OpenAI' THEN 'openai'
                   WHEN 'Anthropic' THEN 'anthropic'
                   WHEN 'Google' THEN 'gemini'
                   ELSE lower(host)
               END AS provider
        FROM public.chat_models
        WHERE id = ANY($1::text[])
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model_ids,
    )
    return {
        cast(str, row["id"]): ModelMetadata(model_id=row["id"], provider=row["provider"])
        for row in rows
    }


async def fetch_entity_types(conn: asyncpg.Connection, project_id: UUID) -> list[EntityTypeInfo]:
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
            s.definition AS std_definition,
            s.examples AS std_examples,
            NULL AS std_format_description,
            s.regex AS std_regex
        FROM web.entity_types et
        LEFT JOIN public.std_entity_types s ON et.standard_entity_type_id = s.id
        WHERE et.project_id = $1
        ORDER BY et.created_at
        """,
        project_id,
    )
    return [
        EntityTypeInfo(
            entity_type_id=cast(UUID | None, row["entity_type_id"]),
            name=row["name"],
            user_definition=row["user_definition"],
            user_examples=row["user_example_values"] or [],
            user_format_description=row["user_format_description"],
            datatype=row["datatype"],
            single_word=row["single_word"],
            exact_length=row["exact_length"],
            unique=row["unique"],
            required=row["required"],
            std_definition=row["std_definition"],
            std_examples=row["std_examples"] or [],
            std_format_description=row["std_format_description"],
            std_regex=row["std_regex"],
        )
        for row in rows
    ]


async def fetch_labeled_pdf_inputs(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    pdf_ids: list[UUID],
) -> list[NerPdfInput]:
    if not pdf_ids:
        return []
    rows = await conn.fetch(
        """
        SELECT p.id AS pdf_id, txt.id AS pdf_txt_id, txt.txt AS full_text
        FROM core.pdfs p
        JOIN LATERAL (
            SELECT id, txt
            FROM workers.pdf_txts
            WHERE pdf_id = p.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) txt ON true
        WHERE p.project_id = $1
          AND p.id = ANY($2::uuid[])
          AND p.has_labels
          AND EXISTS (
              SELECT 1
              FROM core.entity_value_labels labels
              WHERE labels.pdf_id = p.id
          )
        ORDER BY p.id
        """,
        project_id,
        pdf_ids,
    )
    return [
        NerPdfInput(
            pdf_id=cast(UUID, row["pdf_id"]), text=row["full_text"], pdf_txt_id=row["pdf_txt_id"]
        )
        for row in rows
    ]


async def insert_chat_model_eval_run(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    beta: float,
    pdf_ids: list[UUID],
    chat_model_ids: list[str],
) -> UUID:
    return cast(
        UUID,
        await conn.fetchval(
            """
        INSERT INTO workers.chat_model_eval_runs
            (project_id, beta, labeled_pdfs, chat_models)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
            project_id,
            beta,
            pdf_ids,
            chat_model_ids,
        ),
    )


async def insert_chat_model_eval_iteration(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    model_id: str,
    prompt_id: UUID,
    accumulated_usd: float,
    overall_f: float,
    per_entity_scores: dict,
    num_correct_pdfs: int,
    pdf_accuracy: float | None,
    entity_type_metrics: dict,
    incorrectly_predicted_entity_value_ids: list[int],
) -> int:
    scores_json = json.dumps(
        {
            key: {"precision": value.precision, "recall": value.recall, "f": value.f}
            for key, value in per_entity_scores.items()
        }
    )
    return cast(
        int,
        await conn.fetchval(
            """
        INSERT INTO workers.chat_model_eval_iterations
            (chat_model_eval_run_id, model_id, prompt_id, accumulated_usd,
             overall_f, per_entity_scores, num_correct_pdfs, pdf_accuracy,
             entity_type_metrics, incorrectly_predicted_entity_value_ids)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10)
        RETURNING id
        """,
            run_id,
            model_id,
            prompt_id,
            accumulated_usd,
            overall_f,
            scores_json,
            num_correct_pdfs,
            pdf_accuracy,
            json.dumps(entity_type_metrics),
            incorrectly_predicted_entity_value_ids,
        ),
    )


async def complete_chat_model_eval_run(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    best_model_id: str,
    best_overall_f: float,
    best_accuracy_score: float | None,
    accumulated_usd: float,
) -> None:
    await conn.execute(
        """
        UPDATE workers.chat_model_eval_runs
        SET best_model_id = $2,
            best_overall_f = $3,
            best_accuracy_score = $4,
            accumulated_usd = $5
        WHERE id = $1
        """,
        run_id,
        best_model_id,
        best_overall_f,
        best_accuracy_score,
        accumulated_usd,
    )

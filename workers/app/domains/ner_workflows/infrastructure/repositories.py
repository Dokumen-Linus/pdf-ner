from __future__ import annotations

from uuid import UUID

import asyncpg

from app.domains.ner_runs.domain.entities import EntityTypeInfo

from ..domain.entities import (
    DocumentForExtraction,
    ModelMetadata,
    ProjectExtractionConfig,
)


async def fetch_document_for_extraction(
    conn: asyncpg.Connection,
    source_id: UUID,
) -> DocumentForExtraction | None:
    row = await conn.fetchrow(
        """
        SELECT
            s.id AS source_id,
            p.id AS pdf_id,
            p.project_id,
            p.ner_workflow_id,
            txt.txt AS full_text
        FROM core.sources s
        JOIN core.pdfs p ON p.source_id = s.id
        LEFT JOIN LATERAL (
            SELECT txt
            FROM workers.pdf_txts
            WHERE pdf_id = p.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) txt ON true
        WHERE s.id = $1
        """,
        source_id,
    )
    if row is None:
        return None
    return DocumentForExtraction(
        source_id=row["source_id"],
        pdf_id=row["pdf_id"],
        project_id=row["project_id"],
        full_text=row["full_text"],
        ner_workflow_id=row["ner_workflow_id"],
    )


async def fetch_project_config(
    conn: asyncpg.Connection,
    project_id: UUID,
) -> ProjectExtractionConfig | None:
    row = await conn.fetchrow(
        """
        SELECT id, description, active_extract_method, active_chat_model, active_prompt_id
        FROM web.projects
        WHERE id = $1
          AND active_prompt_id IS NOT NULL
        """,
        project_id,
    )
    if row is None:
        return None
    return ProjectExtractionConfig(
        project_id=row["id"],
        description=row["description"],
        extract_method=row["active_extract_method"],
        entity_extraction_model=row["active_chat_model"],
        active_prompt_id=row["active_prompt_id"],
    )


async def fetch_available_model_metadata(
    conn: asyncpg.Connection,
    model: str,
) -> ModelMetadata | None:
    row = await conn.fetchrow(
        """
        SELECT id,
               CASE host
                   WHEN 'OpenAI' THEN 'openai'
                   WHEN 'Anthropic' THEN 'anthropic'
                   WHEN 'Google' THEN 'gemini'
                   ELSE lower(host)
               END AS provider
        FROM public.chat_models
        WHERE id = $1
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model,
    )
    if row is None:
        return None
    return ModelMetadata(model_id=row["id"], provider=row["provider"])


async def fetch_optimized_prompt(
    conn: asyncpg.Connection,
    prompt_id: UUID,
    project_id: UUID,
) -> str | None:
    return await conn.fetchval(
        """
        SELECT full_text
        FROM core.prompts
        WHERE id = $1 AND project_id = $2
        """,
        prompt_id,
        project_id,
    )


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
            entity_type_id=row["entity_type_id"],
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


async def mark_source_processed(conn: asyncpg.Connection, *, source_id: UUID) -> None:
    await conn.execute(
        """
        UPDATE core.sources
        SET status = 'processed',
            last_processed_at = now()
        WHERE id = $1
        """,
        source_id,
    )


async def fail_run(
    conn: asyncpg.Connection,
    *,
    source_id: UUID,
    error_type: str,
    error_message: str,
) -> None:
    await conn.execute(
        """
        UPDATE core.sources
        SET status = 'failed',
            metadata = COALESCE(metadata, '{}'::jsonb)
                || jsonb_build_object('error_type', $2::text, 'error_message', $3::text)
        WHERE id = $1
        """,
        source_id,
        error_type,
        error_message,
    )

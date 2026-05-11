from __future__ import annotations

import json
from uuid import UUID

import asyncpg

from ..domain.entities import (
    DocumentForExtraction,
    EntityTypeInfo,
    ModelMetadata,
    ProjectExtractionConfig,
)


async def fetch_document_for_extraction(
    conn: asyncpg.Connection,
    document_source_id: UUID,
) -> DocumentForExtraction | None:
    row = await conn.fetchrow(
        """
        SELECT ds.id AS document_source_id, ds.pdf_id, ds.project_id, p.full_text
        FROM workers.document_sources ds
        JOIN workers.pdfs p ON p.id = ds.pdf_id
        WHERE ds.id = $1
        """,
        document_source_id,
    )
    if row is None:
        return None
    return DocumentForExtraction(
        document_source_id=row["document_source_id"],
        pdf_id=row["pdf_id"],
        project_id=row["project_id"],
        full_text=row["full_text"],
    )


async def fetch_project_config(
    conn: asyncpg.Connection,
    project_id: UUID,
) -> ProjectExtractionConfig | None:
    row = await conn.fetchrow(
        """
        SELECT id, description, ocr_method, entity_extraction_model
        FROM web.projects
        WHERE id = $1
        """,
        project_id,
    )
    if row is None:
        return None
    return ProjectExtractionConfig(
        project_id=row["id"],
        description=row["description"],
        ocr_method=row["ocr_method"],
        entity_extraction_model=row["entity_extraction_model"],
    )


async def fetch_available_model_metadata(
    conn: asyncpg.Connection,
    model: str,
) -> ModelMetadata | None:
    row = await conn.fetchrow(
        """
        SELECT id, provider
        FROM public.models
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
    optimized_prompt_id: UUID,
    project_id: UUID,
) -> str | None:
    return await conn.fetchval(
        """
        SELECT full_text
        FROM workers.optimized_prompts
        WHERE id = $1 AND project_id = $2
        """,
        optimized_prompt_id,
        project_id,
    )


async def fetch_entity_types(conn: asyncpg.Connection, project_id: UUID) -> list[EntityTypeInfo]:
    rows = await conn.fetch(
        """
        SELECT
            et.name,
            et.user_definition,
            et.user_examples,
            et.user_format_description,
            et.datatype,
            et.single_word,
            et.exact_length,
            et."unique",
            et.required,
            s.definition AS std_definition,
            s.examples AS std_examples,
            s.format_description AS std_format_description,
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
            name=row["name"],
            user_definition=row["user_definition"],
            user_examples=row["user_examples"] or [],
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


async def insert_run(
    conn: asyncpg.Connection,
    *,
    document_source_id: UUID,
    pdf_id: UUID,
    project_id: UUID,
    optimized_prompt_id: UUID,
    ocr_method: str,
    model: str,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO workers.entity_extraction_runs
            (document_source_id, pdf_id, project_id, optimized_prompt_id, status, ocr_method, model)
        VALUES ($1, $2, $3, $4, 'running', $5, $6)
        RETURNING id
        """,
        document_source_id,
        pdf_id,
        project_id,
        optimized_prompt_id,
        ocr_method,
        model,
    )


async def update_pdf_text(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    full_text: str,
    extract_method: str,
    text_by_page: dict,
) -> None:
    await conn.execute(
        """
        UPDATE workers.pdfs
        SET full_text = $2,
            extract_method = $3,
            text_by_page = $4::jsonb
        WHERE id = $1
        """,
        pdf_id,
        full_text,
        extract_method,
        json.dumps(text_by_page),
    )


async def complete_run_and_pdf(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    pdf_id: UUID,
    document_source_id: UUID,
    optimized_prompt_id: UUID,
    extract_method: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    extracted: dict,
) -> None:
    extracted_json = json.dumps(extracted)
    async with conn.transaction():
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
            extracted_json,
            model,
            optimized_prompt_id,
        )
        await conn.execute(
            """
            UPDATE workers.document_sources
            SET status = 'processed',
                last_processed_at = now()
            WHERE id = $1
            """,
            document_source_id,
        )
        await conn.execute(
            """
            UPDATE workers.entity_extraction_runs
            SET status = 'succeeded',
                extract_method = $2,
                input_tokens = $3,
                output_tokens = $4,
                extracted = $5::jsonb,
                finished_at = now()
            WHERE id = $1
            """,
            run_id,
            extract_method,
            input_tokens,
            output_tokens,
            extracted_json,
        )


async def fail_run(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    document_source_id: UUID,
    error_type: str,
    error_message: str,
) -> None:
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE workers.document_sources
            SET status = 'failed'
            WHERE id = $1
            """,
            document_source_id,
        )
        await conn.execute(
            """
            UPDATE workers.entity_extraction_runs
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

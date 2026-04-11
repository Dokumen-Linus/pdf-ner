import json
import logging
from uuid import UUID

import asyncpg

from ..domain.entities import EntityTypeInfo, LabeledAnnotation, LabeledPdf

logger = logging.getLogger(__name__)


async def fetch_project(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT id, name, description FROM web.projects WHERE id = $1",
        project_id,
    )


async def fetch_entity_types_with_std(
    conn: asyncpg.Connection, project_id: UUID
) -> list[EntityTypeInfo]:
    """Fetch entity types joined with their standard definitions."""
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
            s.definition        AS std_definition,
            s.examples          AS std_examples,
            s.format_description AS std_format_description,
            s.regex             AS std_regex
        FROM web.entity_types et
        LEFT JOIN api.std_entity_types s ON et.standard_entity_type_id = s.id
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
        )
        for r in rows
    ]


async def fetch_labeled_pdfs(conn: asyncpg.Connection, project_id: UUID) -> list[LabeledPdf]:
    """Fetch PDFs that have annotations (ground truth labels).

    Joins workers.pdfs (for full_text) with web.annotations (for labels).
    Only returns PDFs that have at least one annotation with a custom_entity_type.
    """
    pdf_rows = await conn.fetch(
        """
        SELECT p.id, p.full_text, p.text_by_page, p.bucket_id, p.filepath
        FROM workers.pdfs p
        WHERE p.project_id = $1
        """,
        project_id,
    )

    if not pdf_rows:
        return []

    pdf_ids = [r["id"] for r in pdf_rows]
    pdf_map = {r["id"]: r for r in pdf_rows}

    ann_rows = await conn.fetch(
        """
        SELECT a.pdf_id, a.custom_entity_type, a.contents, a.page_index
        FROM web.annotations a
        WHERE a.pdf_id = ANY($1)
          AND a.custom_entity_type IS NOT NULL
          AND a.contents IS NOT NULL
        ORDER BY a.pdf_id, a.page_index
        """,
        pdf_ids,
    )

    anns_by_pdf: dict[UUID, list[LabeledAnnotation]] = {}
    for r in ann_rows:
        ann = LabeledAnnotation(
            pdf_id=r["pdf_id"],
            entity_type_name=r["custom_entity_type"],
            labeled_text=r["contents"],
            page_index=r["page_index"],
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
) -> None:
    """Store evaluation results in workers.prompt_evaluations."""
    scores_json = json.dumps(
        {
            k: {"precision": v.precision, "recall": v.recall, "f1": v.f1}
            for k, v in per_entity_scores.items()
        }
    )
    await conn.execute(
        """
        INSERT INTO workers.prompt_evaluations (prompt_id, overall_f1, per_entity_scores)
        VALUES ($1, $2, $3::jsonb)
        """,
        prompt_id,
        overall_f1,
        scores_json,
    )
    logger.info("Inserted evaluation for prompt %s: f1=%.4f", prompt_id, overall_f1)

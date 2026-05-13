from __future__ import annotations

import json
from typing import cast
from uuid import UUID

import asyncpg

from ..domain.entities import EntityTypeInfo, NerRunOrigin, PersistedPrediction
from ..domain.services import normalise_prediction_values


async def insert_run(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    prompt_id: UUID,
    origin: NerRunOrigin,
) -> UUID:
    return cast(
        UUID,
        await conn.fetchval(
            """
        INSERT INTO workers.ner_runs
            (project_id, prompt_id, ner_workflow_id, context_eng_iter_id, model_eval_iter_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
            project_id,
            prompt_id,
            origin.ner_workflow_id,
            origin.context_eng_iter_id,
            origin.model_eval_iter_id,
        ),
    )


async def link_run_to_context_iteration(
    conn: asyncpg.Connection,
    *,
    ner_run_id: UUID,
    context_eng_iter_id: int,
) -> None:
    await conn.execute(
        """
        UPDATE workers.ner_runs
        SET context_eng_iter_id = $2
        WHERE id = $1
        """,
        ner_run_id,
        context_eng_iter_id,
    )


async def link_run_to_model_eval_iteration(
    conn: asyncpg.Connection,
    *,
    ner_run_id: UUID,
    model_eval_iter_id: int,
) -> None:
    await conn.execute(
        """
        UPDATE workers.ner_runs
        SET model_eval_iter_id = $2
        WHERE id = $1
        """,
        ner_run_id,
        model_eval_iter_id,
    )


async def insert_run_pdf(
    conn: asyncpg.Connection,
    *,
    ner_run_id: UUID,
    pdf_id: UUID,
    pdf_txt_id: int | None,
) -> None:
    await conn.execute(
        """
        INSERT INTO workers.ner_run_pdfs (pdf_id, ner_run_id, pdf_txt_id)
        VALUES ($1, $2, $3)
        """,
        pdf_id,
        ner_run_id,
        pdf_txt_id,
    )


async def insert_predictions(
    conn: asyncpg.Connection,
    *,
    ner_run_id: UUID,
    pdf_id: UUID,
    predictions: dict,
    entity_types: list[EntityTypeInfo],
) -> list[PersistedPrediction]:
    rows: list[tuple[UUID, UUID, str, bool, UUID]] = []
    entity_by_name = {entity.name: entity for entity in entity_types}
    for name, raw_value in predictions.items():
        entity = entity_by_name.get(name)
        if entity is None or entity.entity_type_id is None:
            continue
        for text_value in normalise_prediction_values(raw_value):
            rows.append((pdf_id, entity.entity_type_id, text_value, False, ner_run_id))

    persisted: list[PersistedPrediction] = []
    for row in rows:
        entity_value_id = cast(
            int,
            await conn.fetchval(
                """
            INSERT INTO core.entity_values
                (pdf_id, entity_type_id, text_value, is_label, ner_run_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
                *row,
            ),
        )
        persisted.append(
            PersistedPrediction(
                entity_value_id=entity_value_id,
                pdf_id=cast(UUID, row[0]),
                entity_type_id=cast(UUID, row[1]),
                text_value=row[2],
            )
        )
    return persisted


async def insert_pdf_text(
    conn: asyncpg.Connection,
    *,
    pdf_id: UUID,
    full_text: str,
    extract_method: str,
    created_by_domain: str,
    text_by_page: dict,
) -> int:
    return cast(
        int,
        await conn.fetchval(
            """
        INSERT INTO workers.pdf_txts
            (pdf_id, extract_method, created_by_domain, txt, text_by_page)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
        """,
            pdf_id,
            extract_method,
            created_by_domain,
            full_text,
            json.dumps(text_by_page),
        ),
    )

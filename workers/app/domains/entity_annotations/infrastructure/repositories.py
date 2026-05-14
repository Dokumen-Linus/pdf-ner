from __future__ import annotations

import json
from typing import cast
from uuid import UUID

import asyncpg

from ..domain.entities import PredictedEntityValue


async def fetch_predicted_entity_values(
    conn: asyncpg.Connection,
    *,
    ner_run_id: UUID,
    overwrite: bool = False,
) -> list[PredictedEntityValue]:
    rows = await conn.fetch(
        """
        SELECT
            ev.id AS entity_value_id,
            ev.pdf_id,
            ev.text_value,
            et.subtype,
            et.color,
            et.opacity
        FROM core.entity_values ev
        JOIN web.entity_types et ON et.id = ev.entity_type_id
        WHERE ev.ner_run_id = $1
          AND ev.is_label = false
          AND (
            $2::boolean
            OR ev.rect IS NULL
            OR ev.segment_rects IS NULL
            OR ev.page_index IS NULL
          )
        ORDER BY ev.pdf_id, ev.created_at, ev.id
        """,
        ner_run_id,
        overwrite,
    )
    return [
        PredictedEntityValue(
            entity_value_id=row["entity_value_id"],
            pdf_id=cast(UUID, row["pdf_id"]),
            text_value=row["text_value"],
            subtype=row["subtype"],
            color=row["color"],
            opacity=float(row["opacity"]),
        )
        for row in rows
    ]


async def update_entity_value_annotation(
    conn: asyncpg.Connection,
    *,
    entity_value_id: int,
    rect: dict,
    segment_rects: list[dict],
    page_index: int,
    contents: str,
    author: str,
    blend_mode: str | None,
) -> None:
    await conn.execute(
        """
        UPDATE core.entity_values
        SET rect = $2::jsonb,
            segment_rects = $3::jsonb,
            page_index = $4,
            contents = $5,
            author = $6,
            blend_mode = $7
        WHERE id = $1
        """,
        entity_value_id,
        json.dumps(rect),
        json.dumps(segment_rects),
        page_index,
        contents,
        author,
        blend_mode,
    )

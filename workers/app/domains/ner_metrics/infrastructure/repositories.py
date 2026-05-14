from __future__ import annotations

from typing import cast
from uuid import UUID

import asyncpg

from ..domain.entities import LabelValue


async def fetch_label_values(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    pdf_ids: list[UUID],
) -> list[LabelValue]:
    if not pdf_ids:
        return []
    rows = await conn.fetch(
        """
        SELECT
            labels.pdf_id,
            labels.entity_type_id,
            labels.entity_type_name,
            labels.text_value
        FROM core.entity_value_labels labels
        JOIN core.pdfs p ON p.id = labels.pdf_id
        WHERE p.project_id = $1
          AND labels.pdf_id = ANY($2::uuid[])
        ORDER BY labels.pdf_id, labels.entity_type_id, labels.id
        """,
        project_id,
        pdf_ids,
    )
    return [
        LabelValue(
            pdf_id=cast(UUID, row["pdf_id"]),
            entity_type_id=cast(UUID, row["entity_type_id"]),
            entity_type_name=row["entity_type_name"],
            text_value=row["text_value"],
        )
        for row in rows
    ]

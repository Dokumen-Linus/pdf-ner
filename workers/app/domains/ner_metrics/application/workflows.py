from __future__ import annotations

from uuid import UUID

import asyncpg

from ..domain.entities import MetricsResult
from ..domain.services import calculate_metrics, labels_by_pdf_and_entity
from ..infrastructure import repositories as repo


async def calculate_ner_run_metrics(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    pdf_ids: list[UUID],
    pdf_results: list,
    entity_types: list,
    beta: float,
) -> MetricsResult:
    labels = await repo.fetch_label_values(conn, project_id=project_id, pdf_ids=pdf_ids)
    return calculate_metrics(
        pdf_results=pdf_results,
        labels_by_pdf=labels_by_pdf_and_entity(labels),
        entity_types=entity_types,
        beta=beta,
        pdf_count=len(pdf_ids),
    )

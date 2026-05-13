from __future__ import annotations

from app.shared.infrastructure.db import get_pool

from .commands import CreatePredictedEntityAnnotations
from .workflows import create_predicted_entity_annotations_workflow


async def handle_create_predicted_entity_annotations(
    cmd: CreatePredictedEntityAnnotations,
) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        summary = await create_predicted_entity_annotations_workflow(conn, cmd)
    return {
        "ner_run_id": str(cmd.ner_run_id),
        "requested": summary.requested,
        "matched": summary.matched,
        "not_found": summary.not_found,
        "updated": summary.updated,
        "pdfs_changed": summary.pdfs_changed,
    }

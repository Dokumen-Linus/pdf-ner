from __future__ import annotations

from collections import defaultdict
from uuid import UUID

import asyncpg
from pdfium_utils.annotate import (
    TextMarkupAnnotationRequest,
    create_text_markup_annotations,
    normalize_hex_color,
)

from app.shared.infrastructure.s3 import download_pdf_bytes, upload_pdf_bytes

from ..domain.entities import AnnotationSummary, PredictedEntityValue
from ..infrastructure import repositories as repo
from .commands import CreatePredictedEntityAnnotations

_AUTHOR = "Dokumen AI"


async def create_predicted_entity_annotations_workflow(
    conn: asyncpg.Connection,
    cmd: CreatePredictedEntityAnnotations,
) -> AnnotationSummary:
    predictions = await repo.fetch_predicted_entity_values(
        conn,
        ner_run_id=cmd.ner_run_id,
        overwrite=cmd.overwrite,
    )
    by_pdf: dict[UUID, list[PredictedEntityValue]] = defaultdict(list)
    for prediction in predictions:
        by_pdf[prediction.pdf_id].append(prediction)

    matched = 0
    not_found = 0
    updated = 0
    pdfs_changed = 0

    for pdf_id, pdf_predictions in by_pdf.items():
        pdf_bytes, _filepath = await download_pdf_bytes(conn, pdf_id)
        requests = [_request_for_prediction(prediction) for prediction in pdf_predictions]
        annotated_bytes, results = create_text_markup_annotations(pdf_bytes, requests)
        result_by_id = {result.request_id: result for result in results}
        changed_pdf = False

        for prediction in pdf_predictions:
            result = result_by_id[str(prediction.entity_value_id)]
            if not result.found or result.attributes is None:
                not_found += 1
                continue
            matched += 1
            changed_pdf = True
            attributes = result.attributes
            await repo.update_entity_value_annotation(
                conn,
                entity_value_id=prediction.entity_value_id,
                rect=attributes.rect,
                segment_rects=attributes.segment_rects,
                page_index=attributes.page_index,
                contents=attributes.contents,
                author=attributes.author,
                blend_mode=attributes.blend_mode,
            )
            updated += 1

        if changed_pdf:
            await upload_pdf_bytes(conn, pdf_id, annotated_bytes)
            pdfs_changed += 1

    return AnnotationSummary(
        requested=len(predictions),
        matched=matched,
        not_found=not_found,
        updated=updated,
        pdfs_changed=pdfs_changed,
    )


def _request_for_prediction(prediction: PredictedEntityValue) -> TextMarkupAnnotationRequest:
    subtype = prediction.subtype
    blend_mode = "Multiply" if subtype == "highlight" else "Normal"
    return TextMarkupAnnotationRequest(
        request_id=str(prediction.entity_value_id),
        contents=prediction.text_value,
        subtype=subtype,
        color=normalize_hex_color(prediction.color),
        opacity=prediction.opacity,
        author=_AUTHOR,
        blend_mode=blend_mode,
    )

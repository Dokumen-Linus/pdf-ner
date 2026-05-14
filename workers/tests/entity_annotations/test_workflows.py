from unittest.mock import AsyncMock, patch
from uuid import uuid4

from pdfium_utils.annotate import TextMarkupAnnotationAttributes, TextMarkupAnnotationResult
import pytest

from app.domains.entity_annotations.application.commands import CreatePredictedEntityAnnotations
from app.domains.entity_annotations.application.workflows import (
    create_predicted_entity_annotations_workflow,
)
from app.domains.entity_annotations.domain.entities import PredictedEntityValue


@pytest.mark.anyio
async def test_workflow_updates_matched_predictions_and_uploads_pdf():
    conn = AsyncMock()
    ner_run_id = uuid4()
    pdf_id = uuid4()
    first_value_id = 1
    second_value_id = 2
    predictions = [
        PredictedEntityValue(
            entity_value_id=first_value_id,
            pdf_id=pdf_id,
            text_value="John Smith",
            subtype="highlight",
            color="#FF0000",
            opacity=0.6,
        ),
        PredictedEntityValue(
            entity_value_id=second_value_id,
            pdf_id=pdf_id,
            text_value="Missing",
            subtype="underline",
            color="#00FF00",
            opacity=0.4,
        ),
    ]
    attributes = TextMarkupAnnotationAttributes(
        rect={"origin": {"x": 1.0, "y": 2.0}, "size": {"width": 3.0, "height": 4.0}},
        segment_rects=[{"origin": {"x": 1.0, "y": 2.0}, "size": {"width": 3.0, "height": 4.0}}],
        page_index=0,
        contents="John Smith",
        author="Dokumen AI",
        blend_mode="Multiply",
    )

    with (
        patch(
            "app.domains.entity_annotations.application.workflows.repo.fetch_predicted_entity_values",
            new=AsyncMock(return_value=predictions),
        ) as fetch_values,
        patch(
            "app.domains.entity_annotations.application.workflows.download_pdf_bytes",
            new=AsyncMock(return_value=(b"pdf", "doc.pdf")),
        ) as download,
        patch(
            "app.domains.entity_annotations.application.workflows.create_text_markup_annotations",
            return_value=(
                b"annotated",
                [
                    TextMarkupAnnotationResult(str(first_value_id), True, 1, attributes),
                    TextMarkupAnnotationResult(str(second_value_id), False),
                ],
            ),
        ) as annotate,
        patch(
            "app.domains.entity_annotations.application.workflows.repo.update_entity_value_annotation",
            new=AsyncMock(),
        ) as update_annotation,
        patch(
            "app.domains.entity_annotations.application.workflows.upload_pdf_bytes",
            new=AsyncMock(),
        ) as upload,
    ):
        result = await create_predicted_entity_annotations_workflow(
            conn,
            CreatePredictedEntityAnnotations(ner_run_id=ner_run_id),
        )

    assert result.requested == 2
    assert result.matched == 1
    assert result.not_found == 1
    assert result.updated == 1
    assert result.pdfs_changed == 1
    fetch_values.assert_awaited_once_with(conn, ner_run_id=ner_run_id, overwrite=False)
    download.assert_awaited_once_with(conn, pdf_id)
    annotate.assert_called_once()
    upload.assert_awaited_once_with(conn, pdf_id, b"annotated")
    update_annotation.assert_awaited_once()
    assert update_annotation.await_args.kwargs["entity_value_id"] == first_value_id


@pytest.mark.anyio
async def test_workflow_rejects_invalid_entity_type_color_before_pdf_mutation():
    conn = AsyncMock()
    ner_run_id = uuid4()
    pdf_id = uuid4()
    predictions = [
        PredictedEntityValue(
            entity_value_id=1,
            pdf_id=pdf_id,
            text_value="John Smith",
            subtype="highlight",
            color="#F00",
            opacity=0.6,
        )
    ]

    with (
        patch(
            "app.domains.entity_annotations.application.workflows.repo.fetch_predicted_entity_values",
            new=AsyncMock(return_value=predictions),
        ),
        patch(
            "app.domains.entity_annotations.application.workflows.download_pdf_bytes",
            new=AsyncMock(return_value=(b"pdf", "doc.pdf")),
        ),
        patch(
            "app.domains.entity_annotations.application.workflows.create_text_markup_annotations",
        ) as annotate,
    ):
        with pytest.raises(ValueError, match="Invalid #RRGGBB color"):
            await create_predicted_entity_annotations_workflow(
                conn,
                CreatePredictedEntityAnnotations(ner_run_id=ner_run_id),
            )

    annotate.assert_not_called()

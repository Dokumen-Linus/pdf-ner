from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.domains.entity_annotations.infrastructure.repositories import (
    fetch_predicted_entity_values,
    update_entity_value_annotation,
)


@pytest.mark.anyio
async def test_fetch_predicted_entity_values_maps_rows():
    conn = AsyncMock()
    ner_run_id = uuid4()
    entity_value_id = 1
    pdf_id = uuid4()
    conn.fetch.return_value = [
        {
            "entity_value_id": entity_value_id,
            "pdf_id": pdf_id,
            "text_value": "John Smith",
            "subtype": "highlight",
            "color": "#FF0000",
            "opacity": 0.6,
        }
    ]

    result = await fetch_predicted_entity_values(conn, ner_run_id=ner_run_id)

    assert len(result) == 1
    assert result[0].entity_value_id == entity_value_id
    assert result[0].pdf_id == pdf_id
    assert result[0].text_value == "John Smith"
    assert result[0].subtype == "highlight"
    assert result[0].color == "#FF0000"
    assert result[0].opacity == 0.6
    conn.fetch.assert_awaited_once()


@pytest.mark.anyio
async def test_update_entity_value_annotation_serializes_json_fields():
    conn = AsyncMock()
    entity_value_id = 1

    await update_entity_value_annotation(
        conn,
        entity_value_id=entity_value_id,
        rect={"origin": {"x": 1}, "size": {"width": 2}},
        segment_rects=[{"origin": {"x": 1}, "size": {"width": 2}}],
        page_index=0,
        contents="John Smith",
        author="Dokumen AI",
        blend_mode="Multiply",
    )

    conn.execute.assert_awaited_once()
    args = conn.execute.await_args.args
    assert args[1] == entity_value_id
    assert '"origin"' in args[2]
    assert '"origin"' in args[3]

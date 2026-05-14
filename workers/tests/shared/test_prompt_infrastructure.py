from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.shared.infrastructure.prompts import ensure_prompt_full_text


@pytest.mark.anyio
async def test_ensure_prompt_full_text_returns_existing_without_overwrite():
    conn = AsyncMock()
    conn.fetchval.return_value = "existing prompt"

    result = await ensure_prompt_full_text(conn, uuid4(), uuid4())

    assert result == "existing prompt"
    conn.fetch.assert_not_called()
    conn.execute.assert_not_called()


@pytest.mark.anyio
async def test_ensure_prompt_full_text_renders_and_saves_missing_text():
    project_id = uuid4()
    prompt_id = uuid4()
    entity_id = uuid4()
    conn = AsyncMock()
    conn.fetchval.return_value = None
    conn.fetchrow.return_value = {
        "id": prompt_id,
        "project_id": project_id,
        "template_id": 1,
        "project_description": "Invoices",
        "entity_types_order": [entity_id],
        "entity_type_definitions": {str(entity_id): "Invoice identifier"},
        "entity_type_example_values": {str(entity_id): ["INV-1"]},
        "entity_type_example_finds": {str(entity_id): [{"value": "INV-1"}]},
        "template_text": "Project: <PROJECT_DESCRIPTION>\nFields: <ENTITY_TYPES>",
        "current_project_description": "Fallback",
    }
    conn.fetch.return_value = [
        {
            "entity_type_id": entity_id,
            "name": "invoice_id",
            "user_definition": None,
            "user_example_values": [],
            "required": True,
            "unique": True,
            "regex": None,
            "std_definition": None,
            "std_examples": [],
        }
    ]

    result = await ensure_prompt_full_text(conn, prompt_id, project_id)

    assert "Project: Invoices" in result
    assert '["invoice_id"]' in result
    conn.execute.assert_awaited_once()


@pytest.mark.anyio
async def test_ensure_prompt_full_text_fails_for_missing_prompt():
    conn = AsyncMock()
    conn.fetchval.return_value = None
    conn.fetchrow.return_value = None

    with pytest.raises(ValueError, match="Prompt not found"):
        await ensure_prompt_full_text(conn, uuid4(), uuid4())

from decimal import Decimal
import json
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.domains.context_engineering.application import workflows
from app.domains.context_engineering.application.commands import OptimizePrompt
from app.domains.context_engineering.application.workflows import (
    _initial_prompt_attributes,
    _window_around_value,
    prompt_optimization_workflow,
)
from app.domains.context_engineering.domain import services
from app.domains.context_engineering.domain.entities import EntityTypeInfo
from app.domains.ner_runs.domain.entities import NerBatchResult, NerPdfResult, PersistedPrediction
from tests.conftest import PDF_ID_1, PROJECT_ID, PROMPT_ID

TEMPLATE_ID = 1
TEMPLATE_ROW = {
    "id": TEMPLATE_ID,
    "txt": "Project: <PROJECT_DESCRIPTION>\nFields: <ENTITY_TYPES>\nFinds: <EXAMPLE_FINDS>",
    "includes_project_description": True,
    "includes_entity_type_definitions": True,
    "includes_entity_type_example_values": True,
    "includes_entity_type_example_finds": True,
    "includes_entity_type_regex": True,
}


def test_window_around_value_limits_context():
    text = ("a" * 600) + "TARGET" + ("b" * 600)

    window = _window_around_value(text, "TARGET")

    assert window is not None
    assert len(window) == 1006
    assert "TARGET" in window


def test_initial_prompt_attributes_use_user_data_exactly(name_entity_type):
    attrs = _initial_prompt_attributes("Project description", [name_entity_type])

    assert attrs.project_description == "Project description"
    assert attrs.entity_types_order == [name_entity_type.entity_type_id]
    assert attrs.entity_type_definitions[str(name_entity_type.entity_type_id)] == (
        name_entity_type.user_definition
    )
    assert attrs.entity_type_example_values[str(name_entity_type.entity_type_id)] == (
        name_entity_type.user_examples
    )


def test_form_prompt_text_from_structured_attributes(name_entity_type):
    attrs = _initial_prompt_attributes("Invoices", [name_entity_type])
    attrs.entity_type_example_finds[str(name_entity_type.entity_type_id)].append(
        {"pdf_id": str(PDF_ID_1), "value": "John Smith", "explanation": "name"}
    )

    formed = services.form_prompt_text(
        TEMPLATE_ROW["txt"],
        project_description=attrs.project_description,
        entity_types=[name_entity_type],
        entity_type_definitions=attrs.entity_type_definitions,
        entity_type_example_values=attrs.entity_type_example_values,
        entity_type_example_finds=attrs.entity_type_example_finds,
    )

    assert "Invoices" in formed
    assert "full_name" in formed
    assert "John Smith" in formed


@pytest.mark.anyio
async def test_workflow_inserts_structured_prompt_and_updates_run(entity_types, labeled_pdf_1):
    conn = AsyncMock()
    conn.fetchrow.side_effect = [
        {"id": PROJECT_ID, "name": "Test Project", "description": "Invoices"},
        TEMPLATE_ROW,
        {"provider": "openai"},
        {"provider": "openai"},
    ]

    entity_rows = [_entity_row(entity) for entity in entity_types]
    pdf_rows = [
        {
            "id": labeled_pdf_1.pdf_id,
            "pdf_txt_id": 1,
            "full_text": labeled_pdf_1.full_text,
            "text_by_page": None,
            "bucket_id": uuid4(),
            "filepath": "uploads/doc1.pdf",
        }
    ]
    ann_rows = [
        {
            "pdf_id": ann.pdf_id,
            "entity_value_id": 1,
            "entity_type_id": ann.entity_type_id,
            "custom_entity_type": ann.entity_type_name,
            "contents": ann.labeled_text,
            "page_index": ann.page_index,
        }
        for ann in labeled_pdf_1.annotations
    ]
    label_rows = [
        {
            "pdf_id": ann.pdf_id,
            "entity_type_id": ann.entity_type_id,
            "entity_type_name": ann.entity_type_name,
            "text_value": ann.labeled_text,
        }
        for ann in labeled_pdf_1.annotations
    ]
    conn.fetch.side_effect = [entity_rows, pdf_rows, ann_rows, label_rows, label_rows]
    conn.fetchval.side_effect = [uuid4(), PROMPT_ID, 1, uuid4(), uuid4()]

    async def fake_prompt_call(*args, **kwargs):
        return workflows.LLMResponseData(
            text=json.dumps({"context": "John Smith", "explanation": "example"}),
            input_tokens=1,
            output_tokens=1,
        )

    persisted_prediction = PersistedPrediction(
        entity_value_id=1,
        pdf_id=labeled_pdf_1.pdf_id,
        entity_type_id=entity_types[0].entity_type_id,
        text_value="John Smith",
    )
    ner_result = NerBatchResult(
        run_id=uuid4(),
        pdf_results=[
            NerPdfResult(
                pdf_id=labeled_pdf_1.pdf_id,
                predictions={"full_name": "John Smith"},
                persisted_predictions=[persisted_prediction],
            )
        ],
        cost_usd=Decimal("0.01"),
        input_tokens=1,
        output_tokens=1,
    )
    cmd = OptimizePrompt(
        project_id=PROJECT_ID,
        template_id=TEMPLATE_ID,
        labeled_pdfs=[labeled_pdf_1.pdf_id],
        max_cost_usd=Decimal("1.00"),
    )

    with (
        patch.object(workflows, "call_openai", new=AsyncMock(side_effect=fake_prompt_call)),
        patch.object(workflows, "record_llm_usage", new=AsyncMock(return_value=Decimal("0.01"))),
        patch.object(
            workflows, "execute_and_persist_ner_batch", new=AsyncMock(return_value=ner_result)
        ) as execute_batch,
        patch.object(workflows, "link_run_to_context_iteration", new=AsyncMock()) as link_run,
    ):
        result = await prompt_optimization_workflow(conn, {"openai": object()}, cmd)

    assert result["best_prompt_id"] == str(PROMPT_ID)
    assert conn.fetchval.await_count == 5, f"Expected 5, got {conn.fetchval.await_count}"
    prompt_insert_args = conn.fetchval.await_args_list[1].args
    assert prompt_insert_args[7]  # entity_type_example_finds JSON
    assert prompt_insert_args[8]
    assert prompt_insert_args[8] == execute_batch.await_args.kwargs["system_prompt"]
    assert "Project: Invoices" in prompt_insert_args[8]
    assert "John Smith" in prompt_insert_args[8]
    assert link_run.await_count == 2


def _entity_row(entity: EntityTypeInfo) -> dict:
    return {
        "name": entity.name,
        "user_definition": entity.user_definition,
        "user_example_values": entity.user_examples,
        "user_format_description": entity.user_format_description,
        "datatype": entity.datatype,
        "single_word": entity.single_word,
        "exact_length": entity.exact_length,
        "unique": entity.unique,
        "required": entity.required,
        "std_definition": entity.std_definition,
        "std_examples": entity.std_examples,
        "std_format_description": entity.std_format_description,
        "std_regex": entity.std_regex,
        "entity_type_id": entity.entity_type_id,
    }

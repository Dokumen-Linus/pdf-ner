from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.domains.ner_runs.application import workflows
from app.domains.ner_runs.domain.entities import (
    EntityTypeInfo,
    NerPdfInput,
    NerPdfResult,
    NerRunOrigin,
)
from app.domains.ner_runs.domain.services import calculate_f_score
from app.shared.domain.LLMResponseData import LLMResponseData


def test_origin_rejects_multiple_owners():
    with pytest.raises(ValueError, match="only one"):
        NerRunOrigin(ner_workflow_id=uuid4(), context_eng_iter_id=uuid4())


def test_calculates_beta_weighted_f_score():
    result = calculate_f_score(["a"], ["a", "b"], beta=2.0)
    assert result.precision == 1.0
    assert result.recall == 0.5
    assert result.f == pytest.approx(0.5555555)


@pytest.mark.anyio
async def test_model_provider_routing_openai(monkeypatch):
    calls = []

    async def fake_call_openai(client, model, system_prompt, user_prompt, **kwargs):
        calls.append((client, model, system_prompt, user_prompt, kwargs))
        return LLMResponseData(text="{}", input_tokens=1, output_tokens=2)

    monkeypatch.setattr(workflows, "call_openai", fake_call_openai)

    result = await workflows.call_ner_model(
        {"openai": object()},
        provider="openai",
        model="gpt-4o",
        system_prompt="system",
        user_prompt="user",
        schema={"type": "object"},
        schema_name="ner_workflows",
    )

    assert result.input_tokens == 1
    assert calls[0][4]["schema_name"] == "ner_workflows"
    assert calls[0][4]["schema"] == {"type": "object"}


@pytest.mark.anyio
async def test_model_provider_routing_anthropic_includes_schema(monkeypatch):
    calls = []

    async def fake_call_anthropic(client, model, system_prompt, user_prompt):
        calls.append((client, model, system_prompt, user_prompt))
        return LLMResponseData(text="{}", input_tokens=3, output_tokens=4)

    monkeypatch.setattr(workflows, "call_anthropic", fake_call_anthropic)

    result = await workflows.call_ner_model(
        {"anthropic": object()},
        provider="anthropic",
        model="claude-sonnet-4-5",
        system_prompt="system",
        user_prompt="user",
        schema={"type": "object"},
        schema_name="context_engineering",
    )

    assert result.output_tokens == 4
    assert "JSON Schema" in calls[0][2]
    assert '"type": "object"' in calls[0][2]


@pytest.mark.anyio
async def test_model_provider_routing_gemini_requests_json(monkeypatch):
    calls = []

    async def fake_call_google_genai(client, model, system_prompt, user_prompt, **kwargs):
        calls.append((client, model, system_prompt, user_prompt, kwargs))
        return LLMResponseData(text="{}", input_tokens=5, output_tokens=6)

    monkeypatch.setattr(workflows, "call_google_genai", fake_call_google_genai)

    result = await workflows.call_ner_model(
        {"gemini": object()},
        provider="gemini",
        model="gemini-2.0-flash",
        system_prompt="system",
        user_prompt="user",
        schema={"type": "object"},
        schema_name="context_engineering",
    )

    assert result.input_tokens == 5
    assert calls[0][4]["json_response"] is True
    assert "JSON Schema" in calls[0][2]


@pytest.mark.anyio
async def test_model_provider_routing_rejects_unsupported_provider():
    with pytest.raises(ValueError, match="Unsupported model provider"):
        await workflows.call_ner_model(
            {},
            provider="unsupported",
            model="model",
            system_prompt="system",
            user_prompt="user",
            schema={},
            schema_name="test",
        )


@pytest.mark.anyio
async def test_persist_ner_batch_invokes_annotation_workflow_when_enabled():
    conn = AsyncMock()
    run_id = uuid4()
    pdf_id = uuid4()
    prompt_id = uuid4()
    project_id = uuid4()
    entity_type = EntityTypeInfo(
        name="full_name",
        user_definition=None,
        user_examples=[],
        user_format_description=None,
        datatype=None,
        single_word=False,
        exact_length=None,
        unique=True,
        required=True,
        entity_type_id=uuid4(),
    )

    with (
        patch.object(workflows.repo, "insert_run", new=AsyncMock(return_value=run_id)),
        patch.object(workflows.repo, "insert_run_pdf", new=AsyncMock()),
        patch.object(workflows.repo, "insert_predictions", new=AsyncMock(return_value=[])),
        patch.object(
            workflows,
            "create_predicted_entity_annotations_workflow",
            new=AsyncMock(),
        ) as annotate,
    ):
        result = await workflows.persist_ner_batch(
            conn,
            project_id=project_id,
            prompt_id=prompt_id,
            origin=NerRunOrigin(),
            pdfs=[NerPdfInput(pdf_id=pdf_id, text="John Smith")],
            entity_types=[entity_type],
            pdf_results=[NerPdfResult(pdf_id=pdf_id, predictions={"full_name": "John Smith"})],
            make_annotations=True,
        )

    assert result.run_id == run_id
    annotate.assert_awaited_once()
    assert annotate.await_args.args[1].ner_run_id == run_id


@pytest.mark.anyio
async def test_execute_and_persist_defaults_to_no_annotations(monkeypatch):
    conn = AsyncMock()
    executed = workflows.NerBatchResult(
        run_id=None,
        pdf_results=[],
        cost_usd=Decimal("0"),
        input_tokens=0,
        output_tokens=0,
    )
    persisted = workflows.NerBatchResult(
        run_id=uuid4(),
        pdf_results=[],
        cost_usd=Decimal("0"),
        input_tokens=0,
        output_tokens=0,
    )
    execute = AsyncMock(return_value=executed)
    persist = AsyncMock(return_value=persisted)
    monkeypatch.setattr(workflows, "execute_ner_batch", execute)
    monkeypatch.setattr(workflows, "persist_ner_batch", persist)

    await workflows.execute_and_persist_ner_batch(
        conn,
        {},
        provider="openai",
        model="gpt-4o",
        project_id=uuid4(),
        prompt_id=uuid4(),
        origin=NerRunOrigin(),
        task_name="test",
        schema_name="test",
        system_prompt="system",
        pdfs=[],
        entity_types=[],
    )

    assert persist.await_args.kwargs["make_annotations"] is False

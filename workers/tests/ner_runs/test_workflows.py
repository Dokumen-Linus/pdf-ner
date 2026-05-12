from uuid import uuid4

import pytest

from app.domains.ner_runs.application import workflows
from app.domains.ner_runs.domain.entities import NerRunOrigin
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

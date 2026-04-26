from uuid import uuid4

import pytest

from app.domains.entity_extraction.application import workflows
from app.domains.entity_extraction.domain.entities import EntityTypeInfo, ProjectExtractionConfig
from app.domains.entity_extraction.domain.services import (
    build_fallback_system_prompt,
    build_json_schema,
)
from app.domains.entity_extraction.domain.value_objects import (
    PageText,
    has_usable_text,
    join_page_text,
)


def test_build_json_schema_uses_entity_constraints():
    entity_types = [
        EntityTypeInfo(
            name="invoice_number",
            user_definition="Invoice identifier",
            user_examples=["INV-100"],
            user_format_description=None,
            datatype="alphanumeric",
            single_word=True,
            exact_length=None,
            unique=True,
            required=True,
        ),
        EntityTypeInfo(
            name="line_amounts",
            user_definition="Line item amounts",
            user_examples=[],
            user_format_description=None,
            datatype="float",
            single_word=False,
            exact_length=None,
            unique=False,
            required=False,
        ),
    ]

    schema = build_json_schema(entity_types)

    assert schema["required"] == ["invoice_number", "line_amounts"]
    assert schema["properties"]["invoice_number"]["type"] == "string"
    assert schema["properties"]["line_amounts"]["items"]["type"] == "number"
    assert schema["additionalProperties"] is False


def test_build_fallback_system_prompt_includes_project_and_fields():
    project = ProjectExtractionConfig(
        project_id=uuid4(),
        description="Invoices",
        ocr_method="tesseract",
        entity_extraction_model="gpt-4o",
    )
    entity = EntityTypeInfo(
        name="vendor",
        user_definition="Vendor name",
        user_examples=["Acme"],
        user_format_description=None,
        datatype="alpha",
        single_word=False,
        exact_length=None,
        unique=True,
        required=True,
    )

    prompt = build_fallback_system_prompt(project, [entity])

    assert "Invoices" in prompt
    assert "vendor" in prompt
    assert "Vendor name" in prompt


def test_text_helpers_join_and_detect_content():
    pages = [PageText(page_index=0, text=" Hello "), PageText(page_index=1, text="World")]

    assert join_page_text(pages) == "Hello\n\nWorld"
    assert has_usable_text(" text ")
    assert not has_usable_text("   ")


@pytest.mark.anyio
async def test_model_provider_routing_openai(monkeypatch):
    calls = []

    async def fake_call_openai(client, model, system_prompt, user_prompt, **kwargs):
        calls.append((client, model, system_prompt, user_prompt, kwargs))
        return workflows.LLMResponseData(text="{}", input_tokens=1, output_tokens=2)

    monkeypatch.setattr(workflows, "call_openai", fake_call_openai)

    result = await workflows._call_llm_for_model(
        {"openai": object()},
        "openai",
        "gpt-4o",
        "system",
        "user",
        {"type": "object"},
    )

    assert result.input_tokens == 1
    assert calls[0][4]["schema_name"] == "entity_extraction"
    assert calls[0][4]["schema"] == {"type": "object"}


@pytest.mark.anyio
async def test_model_provider_routing_anthropic_includes_schema(monkeypatch):
    calls = []

    async def fake_call_anthropic(client, model, system_prompt, user_prompt):
        calls.append((client, model, system_prompt, user_prompt))
        return workflows.LLMResponseData(text="{}", input_tokens=3, output_tokens=4)

    monkeypatch.setattr(workflows, "call_anthropic", fake_call_anthropic)

    result = await workflows._call_llm_for_model(
        {"anthropic": object()},
        "anthropic",
        "claude-sonnet-4-5",
        "system",
        "user",
        {"type": "object"},
    )

    assert result.output_tokens == 4
    assert "JSON Schema" in calls[0][2]
    assert '"type": "object"' in calls[0][2]


@pytest.mark.anyio
async def test_model_provider_routing_gemini_requests_json(monkeypatch):
    calls = []

    async def fake_call_google_genai(client, model, system_prompt, user_prompt, **kwargs):
        calls.append((client, model, system_prompt, user_prompt, kwargs))
        return workflows.LLMResponseData(text="{}", input_tokens=5, output_tokens=6)

    monkeypatch.setattr(workflows, "call_google_genai", fake_call_google_genai)

    result = await workflows._call_llm_for_model(
        {"gemini": object()},
        "gemini",
        "gemini-2.0-flash",
        "system",
        "user",
        {"type": "object"},
    )

    assert result.input_tokens == 5
    assert calls[0][4]["json_response"] is True
    assert "JSON Schema" in calls[0][2]


@pytest.mark.anyio
async def test_model_provider_routing_rejects_unsupported_provider():
    with pytest.raises(ValueError, match="Unsupported model provider"):
        await workflows._call_llm_for_model({}, "unsupported", "model", "system", "user", {})

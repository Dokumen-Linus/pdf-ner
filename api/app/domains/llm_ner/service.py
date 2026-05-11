from decimal import Decimal
import json
import logging
from uuid import UUID

import asyncpg
from fastapi import HTTPException

from app.domains.shared.schemas import LLMResponseData
from app.integrations.anthropic import call_anthropic_async
from app.integrations.gemini import call_google_ai_async
from app.integrations.openai import call_openai_async

from . import repository
from .schemas import ExtractEntitiesRequest

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = {"anthropic", "gemini", "openai"}


def build_prompt_from_template(
    template_txt: str,
    project_description: str | None,
    entity_types: list[asyncpg.Record],
) -> str:
    """Build the system prompt by interpolating placeholders in the template."""
    names = [et["name"] for et in entity_types]
    definitions = [et["page1_definition"] or "" for et in entity_types]
    examples = [et["page1_examples"] or [] for et in entity_types]
    constraints = [et["page1_datatype"] or "" for et in entity_types]
    is_required = [et["required"] for et in entity_types]
    is_unique = [et["unique"] for et in entity_types]

    prompt = template_txt
    prompt = prompt.replace("<PROJECT_DESCRIPTION>", project_description or "")
    prompt = prompt.replace("<ENTITY_TYPES>", str(names))
    prompt = prompt.replace("<DEFINITIONS>", str(definitions))
    prompt = prompt.replace("<EXAMPLE_VALUES>", str(examples))
    prompt = prompt.replace("<CONSTRAINTS>", str(constraints))
    prompt = prompt.replace("<IS_REQUIRED>", str(is_required))
    prompt = prompt.replace("<IS_UNIQUE>", str(is_unique))

    return prompt


async def call_llm(
    clients: dict,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> LLMResponseData:
    """Route to appropriate LLM based on provider. Returns LLMResponseData with text + token counts."""
    if provider == "anthropic":
        return await call_anthropic_async(clients["anthropic"], model, system_prompt, user_prompt)
    elif provider == "openai":
        return await call_openai_async(clients["openai"], model, system_prompt, user_prompt)
    elif provider == "gemini":
        return await call_google_ai_async(clients["gemini"], model, system_prompt, user_prompt)
    else:
        raise HTTPException(status_code=422, detail=f"Unknown provider: {provider}")


def validate_json(response_text: str) -> dict:
    """Parse response as JSON, raise HTTPException if invalid."""
    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        logger.error("LLM response is not valid JSON: %s", e)
        raise HTTPException(status_code=422, detail="LLM response is not valid JSON") from None


async def extract_entities(
    conn: asyncpg.Connection,
    clients: dict,
    request: ExtractEntitiesRequest,
) -> dict:
    """Orchestration function for entity extraction."""
    project = await repository.fetch_project(conn, request.project_id)
    if not project:
        logger.error("Project not found: %s", request.project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    model = await repository.fetch_available_model(conn, request.model)
    if not model:
        raise HTTPException(status_code=422, detail=f"Model is not available: {request.model}")
    provider = model["provider"]
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=422, detail=f"Unsupported model provider: {provider}")

    entity_types = await repository.fetch_entity_types(conn, request.project_id)
    if not entity_types:
        logger.error("No entity types defined for project: %s", request.project_id)
        raise HTTPException(status_code=400, detail="No entity types defined for project")

    template = await repository.fetch_template(conn, request.template_id)
    if not template:
        logger.error("Template not found: %s", request.template_id)
        raise HTTPException(status_code=404, detail="Template not found")

    system_prompt = build_prompt_from_template(
        template["txt"],
        project["description"],
        entity_types,
    )

    document_text = request.document_text
    if not document_text and request.pdf_id is not None:
        found, pdf_text = await repository.fetch_pdf_text(conn, request.pdf_id, request.project_id)
        if not found:
            raise HTTPException(status_code=404, detail="PDF not found in this project")
        if not pdf_text or not pdf_text.strip():
            raise HTTPException(status_code=422, detail="PDF has no text content")
        document_text = pdf_text

    prompt_id: UUID = await repository.insert_prompt(
        conn,
        request.project_id,
        request.template_id,
        system_prompt,
    )

    try:
        llm_usage: LLMResponseData = await call_llm(
            clients,
            provider,
            request.model,
            system_prompt,
            document_text,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("LLM provider error: %s", e)
        raise HTTPException(status_code=502, detail="LLM provider error") from None

    # Record usage (non-blocking best-effort)
    input_cost_usd = Decimal(
        str(round((llm_usage.input_tokens * float(model["usd_per_1m_input"])) / 1_000_000, 8))
    )
    output_cost_usd = Decimal(
        str(round((llm_usage.output_tokens * float(model["usd_per_1m_output"])) / 1_000_000, 8))
    )
    try:
        await repository.record_llm_usage(
            conn,
            actor_user_id=request.user_id,
            project_id=request.project_id,
            model=request.model,
            input_tokens=llm_usage.input_tokens,
            output_tokens=llm_usage.output_tokens,
            input_cost_usd=input_cost_usd,
            output_cost_usd=output_cost_usd,
        )
    except Exception:
        logger.exception(
            "Failed to record LLM usage: model=%s in=%d out=%d",
            request.model,
            llm_usage.input_tokens,
            llm_usage.output_tokens,
        )

    extracted = validate_json(llm_usage.text)

    return {
        "prompt_id": str(prompt_id),
        "extracted": extracted,
    }

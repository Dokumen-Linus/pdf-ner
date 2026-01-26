import json
import logging
import time
from uuid import UUID

import asyncpg
from fastapi import HTTPException

from app.utils.llm_calls.anthropic import call_anthropic_async
from app.utils.llm_calls.gemini import call_google_ai_async
from app.utils.llm_calls.openai import call_openai_async

from . import repository
from .schemas import ExtractEntitiesRequest

logger = logging.getLogger(__name__)


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
) -> str:
    """Route to appropriate LLM based on provider."""
    if provider == "anthropic":
        return await call_anthropic_async(
            clients["anthropic"], model, system_prompt, user_prompt
        )
    elif provider == "openai":
        return await call_openai_async(clients["openai"], model, system_prompt, user_prompt)
    elif provider == "gemini":
        return await call_google_ai_async(
            clients["gemini"], model, system_prompt, user_prompt
        )
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
    # Fetch project
    project = await repository.fetch_project(conn, request.project_id)
    if not project:
        logger.error("Project not found: %s", request.project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch entity types
    entity_types = await repository.fetch_entity_types(conn, request.project_id)
    if not entity_types:
        logger.error("No entity types defined for project: %s", request.project_id)
        raise HTTPException(status_code=400, detail="No entity types defined for project")

    # Fetch template
    template = await repository.fetch_template(conn, request.template_id)
    if not template:
        logger.error("Template not found: %s", request.template_id)
        raise HTTPException(status_code=404, detail="Template not found")

    # Build prompt
    system_prompt = build_prompt_from_template(
        template["txt"],
        project["description"],
        entity_types,
    )

    # Save prompt to database
    prompt_id: UUID = await repository.insert_prompt(
        conn,
        request.project_id,
        request.template_id,
        system_prompt,
    )

    # Call LLM
    logger.info(
        "LLM call started: provider=%s, model=%s, project_id=%s",
        request.provider,
        request.model,
        request.project_id,
    )
    start_time = time.perf_counter()

    try:
        llm_response = await call_llm(
            clients,
            request.provider,
            request.model,
            system_prompt,
            request.document_text,
        )
    except Exception as e:
        logger.error("LLM provider error: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM provider error: {e}") from None

    duration = time.perf_counter() - start_time
    logger.info("LLM call completed: duration=%.2fs", duration)

    # Validate JSON
    extracted = validate_json(llm_response)

    return {
        "prompt_id": str(prompt_id),
        "extracted": extracted,
    }

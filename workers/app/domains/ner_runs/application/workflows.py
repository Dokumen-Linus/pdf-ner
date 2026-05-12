from __future__ import annotations

from decimal import Decimal
import json
import logging
from typing import Any
from uuid import UUID

import asyncpg

from app.domains.llm_usage.infrastructure.repository import record_llm_usage
from app.integrations.anthropic import call_anthropic
from app.integrations.gemini import call_google_genai
from app.integrations.openai import call_openai
from app.shared.domain.LLMResponseData import LLMResponseData

from ..domain import services
from ..domain.entities import (
    EntityTypeInfo,
    NerBatchResult,
    NerPdfInput,
    NerPdfResult,
    NerRunOrigin,
)
from ..infrastructure import repositories as repo

logger = logging.getLogger(__name__)

_SUPPORTED_PROVIDERS = {"openai", "anthropic", "gemini"}


def append_json_schema_instruction(system_prompt: str, schema: dict) -> str:
    return (
        f"{system_prompt}\n\n"
        "Return only valid JSON that matches this JSON Schema:\n"
        f"{json.dumps(schema, sort_keys=True)}"
    )


async def call_ner_model(
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema: dict,
    schema_name: str,
) -> LLMResponseData:
    if provider not in _SUPPORTED_PROVIDERS:
        raise ValueError(f"Unsupported model provider: {provider}")
    if provider == "openai":
        return await call_openai(
            clients["openai"],
            model,
            system_prompt,
            user_prompt,
            schema=schema,
            schema_name=schema_name,
        )
    if provider == "anthropic":
        return await call_anthropic(
            clients["anthropic"],
            model,
            append_json_schema_instruction(system_prompt, schema),
            user_prompt,
        )
    return await call_google_genai(
        clients["gemini"],
        model,
        append_json_schema_instruction(system_prompt, schema),
        user_prompt,
        json_response=True,
    )


async def execute_ner_batch(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    task_name: str,
    schema_name: str,
    system_prompt: str,
    pdfs: list[NerPdfInput],
    entity_types: list[EntityTypeInfo],
) -> NerBatchResult:
    schema = services.build_json_schema(entity_types)
    results: list[NerPdfResult] = []
    total_cost = Decimal("0")
    input_tokens = 0
    output_tokens = 0

    for pdf in pdfs:
        llm_usage = await call_ner_model(
            clients,
            provider=provider,
            model=model,
            system_prompt=system_prompt,
            user_prompt=pdf.text,
            schema=schema,
            schema_name=schema_name,
        )
        usage_cost = await record_llm_usage(
            conn,
            model=model,
            input_tokens=llm_usage.input_tokens,
            output_tokens=llm_usage.output_tokens,
            project_id=project_id,
            task_name=task_name,
        )
        total_cost += usage_cost
        input_tokens += llm_usage.input_tokens
        output_tokens += llm_usage.output_tokens
        try:
            predictions = json.loads(llm_usage.text)
        except json.JSONDecodeError:
            logger.warning("Invalid NER JSON from LLM for PDF %s", pdf.pdf_id)
            predictions = {}
        results.append(NerPdfResult(pdf_id=pdf.pdf_id, predictions=predictions))

    return NerBatchResult(
        run_id=None,
        pdf_results=results,
        cost_usd=total_cost,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


async def persist_ner_batch(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    prompt_id: UUID,
    origin: NerRunOrigin,
    pdfs: list[NerPdfInput],
    entity_types: list[EntityTypeInfo],
    pdf_results: list[NerPdfResult],
) -> NerBatchResult:
    run_id = await repo.insert_run(
        conn,
        project_id=project_id,
        prompt_id=prompt_id,
        origin=origin,
    )
    pdf_by_id = {pdf.pdf_id: pdf for pdf in pdfs}
    persisted_results: list[NerPdfResult] = []
    for result in pdf_results:
        pdf = pdf_by_id[result.pdf_id]
        await repo.insert_run_pdf(
            conn,
            ner_run_id=run_id,
            pdf_id=pdf.pdf_id,
            pdf_txt_id=pdf.pdf_txt_id,
        )
        persisted_predictions = await repo.insert_predictions(
            conn,
            ner_run_id=run_id,
            pdf_id=pdf.pdf_id,
            predictions=result.predictions,
            entity_types=entity_types,
        )
        persisted_results.append(
            NerPdfResult(
                pdf_id=result.pdf_id,
                predictions=result.predictions,
                persisted_predictions=persisted_predictions,
            )
        )
    return NerBatchResult(
        run_id=run_id,
        pdf_results=persisted_results,
        cost_usd=Decimal("0"),
        input_tokens=0,
        output_tokens=0,
    )


async def execute_and_persist_ner_batch(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    prompt_id: UUID,
    origin: NerRunOrigin,
    task_name: str,
    schema_name: str,
    system_prompt: str,
    pdfs: list[NerPdfInput],
    entity_types: list[EntityTypeInfo],
) -> NerBatchResult:
    executed = await execute_ner_batch(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        task_name=task_name,
        schema_name=schema_name,
        system_prompt=system_prompt,
        pdfs=pdfs,
        entity_types=entity_types,
    )
    persisted = await persist_ner_batch(
        conn,
        project_id=project_id,
        prompt_id=prompt_id,
        origin=origin,
        pdfs=pdfs,
        entity_types=entity_types,
        pdf_results=executed.pdf_results,
    )
    return NerBatchResult(
        run_id=persisted.run_id,
        pdf_results=persisted.pdf_results,
        cost_usd=executed.cost_usd,
        input_tokens=executed.input_tokens,
        output_tokens=executed.output_tokens,
    )

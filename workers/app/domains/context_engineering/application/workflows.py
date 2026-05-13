from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import json
import logging
from typing import Any
from uuid import UUID

import asyncpg

from app.domains.llm_usage.infrastructure.repository import record_llm_usage
from app.domains.ner_metrics.application.workflows import calculate_ner_run_metrics
from app.domains.ner_runs.application.workflows import execute_and_persist_ner_batch
from app.domains.ner_runs.domain.entities import NerPdfInput, NerRunOrigin
from app.domains.ner_runs.infrastructure.repositories import link_run_to_context_iteration
from app.integrations.anthropic import call_anthropic
from app.integrations.gemini import call_google_genai
from app.integrations.openai import call_openai
from app.shared.domain.LLMResponseData import LLMResponseData

from ..domain import services
from ..domain.entities import EntityTypeInfo, LabeledPdf
from ..domain.value_objects import CostBudget
from ..infrastructure import repositories as repo
from .commands import OptimizePrompt

logger = logging.getLogger(__name__)

_TASK_NAME = "context_engineering.optimize_prompt"


@dataclass
class PromptAttributes:
    project_description: str | None
    entity_types_order: list[UUID]
    entity_type_definitions: dict[str, str]
    entity_type_example_values: dict[str, list[str]]
    entity_type_example_finds: dict[str, list[dict]]


def _report_progress(
    task: Any | None, phase: str, message: str, percent: int, **details: Any
) -> None:
    if task is None:
        return
    task.update_state(
        state="PROGRESS",
        meta={"phase": phase, "message": message, "percent": percent, "details": details},
    )


async def prompt_optimization_workflow(
    conn: asyncpg.Connection,
    llm_clients: dict[str, Any],
    cmd: OptimizePrompt,
    task: Any | None = None,
) -> dict:
    budget = CostBudget(max_cost_usd=cmd.max_cost_usd)
    context_llm_cost = Decimal("0")
    stop_reason = "completed"

    project = await repo.fetch_project(conn, cmd.project_id)
    if not project:
        raise ValueError(f"Project not found: {cmd.project_id}")

    template = await repo.fetch_template(conn, cmd.template_id)
    if not template:
        raise ValueError(f"Template not found: {cmd.template_id}")

    ner_provider = await repo.fetch_model_provider(conn, cmd.ner_chat_model)
    if ner_provider is None:
        raise ValueError(f"NER model is not available: {cmd.ner_chat_model}")
    prompt_provider = await repo.fetch_model_provider(conn, cmd.prompt_eng_chat_model)
    if prompt_provider is None:
        raise ValueError(f"Prompt engineering model is not available: {cmd.prompt_eng_chat_model}")

    entity_types = await repo.fetch_entity_types_with_std(conn, cmd.project_id)
    if not entity_types:
        raise ValueError(f"No entity types for project: {cmd.project_id}")
    if any(entity.entity_type_id is None for entity in entity_types):
        raise ValueError("All entity types must have ids for context engineering")

    labeled_pdfs = await repo.fetch_labeled_pdfs(conn, cmd.project_id, cmd.labeled_pdfs)
    found_pdf_ids = {pdf.pdf_id for pdf in labeled_pdfs}
    missing_pdf_ids = set(cmd.labeled_pdfs) - found_pdf_ids
    if missing_pdf_ids:
        raise ValueError(f"Labeled PDFs are invalid or missing text: {sorted(missing_pdf_ids)}")

    context_eng_run_id = await repo.insert_context_engineering_run(
        conn,
        project_id=cmd.project_id,
        beta=cmd.beta,
        max_usd=cmd.max_cost_usd,
        labeled_pdfs=cmd.labeled_pdfs,
    )
    _report_progress(
        task,
        "data_fetched",
        f"Loaded {len(labeled_pdfs)} labeled PDFs and {len(entity_types)} entity types",
        5,
    )

    attributes = _initial_prompt_attributes(project["description"], entity_types)
    example_find_cost = await _populate_example_finds(
        conn,
        llm_clients,
        provider=prompt_provider,
        model=cmd.prompt_eng_chat_model,
        project_id=cmd.project_id,
        attributes=attributes,
        entity_types=entity_types,
        labeled_pdfs=labeled_pdfs,
    )
    context_llm_cost += example_find_cost

    best_prompt_id: UUID | None = None
    best_overall_f = -1.0
    previous_f = -1.0
    previous_incorrect_ids: list[UUID] = []
    previous_missed_entity_types: list[dict] = []
    iterations_run = 0

    iteration = 0
    while True:
        if budget.spent_cost_usd + context_llm_cost >= budget.max_cost_usd:
            stop_reason = "max_cost_reached"
            break

        if iteration > 0:
            modifier_cost = await _modify_attributes_from_incorrect_predictions(
                conn,
                llm_clients,
                provider=prompt_provider,
                model=cmd.prompt_eng_chat_model,
                project_id=cmd.project_id,
                attributes=attributes,
                incorrect_entity_value_ids=previous_incorrect_ids,
                missed_entity_types=previous_missed_entity_types,
            )
            context_llm_cost += modifier_cost

        if budget.spent_cost_usd + context_llm_cost >= budget.max_cost_usd:
            stop_reason = "max_cost_reached"
            break

        formed_prompt = services.form_prompt_text(
            template["txt"],
            project_description=attributes.project_description,
            entity_types=_ordered_entity_types(entity_types, attributes.entity_types_order),
            entity_type_definitions=attributes.entity_type_definitions,
            entity_type_example_values=attributes.entity_type_example_values,
            entity_type_example_finds=attributes.entity_type_example_finds,
        )
        prompt_id = await repo.insert_prompt_attributes(
            conn,
            project_id=cmd.project_id,
            template_id=cmd.template_id,
            full_text=formed_prompt,
            project_description=attributes.project_description,
            entity_types_order=attributes.entity_types_order,
            entity_type_definitions=attributes.entity_type_definitions,
            entity_type_example_values=attributes.entity_type_example_values,
            entity_type_example_finds=attributes.entity_type_example_finds,
        )
        await _insert_prompt_examples_for_attributes(conn, prompt_id, attributes)
        ner_result = await execute_and_persist_ner_batch(
            conn,
            llm_clients,
            provider=ner_provider,
            model=cmd.ner_chat_model,
            project_id=cmd.project_id,
            prompt_id=prompt_id,
            origin=NerRunOrigin(),
            task_name=_TASK_NAME,
            schema_name="context_engineering",
            system_prompt=formed_prompt,
            pdfs=[
                NerPdfInput(pdf.pdf_id, pdf.full_text or "", pdf.pdf_txt_id) for pdf in labeled_pdfs
            ],
            entity_types=entity_types,
            make_annotations=False,
        )
        budget.add_usage(ner_result.cost_usd)
        metrics = await calculate_ner_run_metrics(
            conn,
            project_id=cmd.project_id,
            pdf_ids=[pdf.pdf_id for pdf in labeled_pdfs],
            pdf_results=ner_result.pdf_results,
            entity_types=entity_types,
            beta=cmd.beta,
        )
        iteration_id = await repo.insert_evaluation(
            conn,
            context_eng_run_id,
            prompt_id,
            metrics.overall_f,
            metrics.per_entity_scores,
            pdfs_fully_correct=metrics.num_correct_pdfs,
            pdf_accuracy=metrics.pdf_accuracy,
            entity_type_metrics=metrics.entity_type_metrics,
            incorrectly_predicted_entity_value_ids=metrics.incorrectly_predicted_entity_value_ids,
        )
        if ner_result.run_id is not None:
            await link_run_to_context_iteration(
                conn,
                ner_run_id=ner_result.run_id,
                context_eng_iter_id=iteration_id,
            )

        iterations_run = iteration + 1
        previous_incorrect_ids = metrics.incorrectly_predicted_entity_value_ids
        previous_missed_entity_types = metrics.missed_entity_types
        overall_f = metrics.overall_f
        if overall_f > best_overall_f:
            best_overall_f = overall_f
            best_prompt_id = prompt_id
        _report_progress(
            task,
            "iteration_complete",
            f"Iteration {iterations_run} complete - F: {overall_f:.3f}",
            min(95, 15 + iterations_run * 25),
            incorrectly_predicted_count=len(previous_incorrect_ids),
        )

        if not previous_incorrect_ids and not previous_missed_entity_types:
            stop_reason = "no_errors"
            break
        if previous_f >= 0 and overall_f - previous_f < cmd.convergence_threshold:
            stop_reason = "converged"
            break
        previous_f = overall_f
        iteration += 1

    if best_prompt_id is None:
        raise ValueError("Cost budget exhausted before any prompt could be evaluated")
    if (
        budget.spent_cost_usd + context_llm_cost >= budget.max_cost_usd
        and stop_reason == "completed"
    ):
        stop_reason = "max_cost_reached"

    total_cost = budget.spent_cost_usd + context_llm_cost
    await repo.complete_context_engineering_run(
        conn,
        run_id=context_eng_run_id,
        best_prompt_id=best_prompt_id,
        best_overall_f=best_overall_f,
        accumulated_usd=total_cost,
        stop_reason=stop_reason,
    )
    return {
        "best_prompt_id": str(best_prompt_id),
        "best_f": best_overall_f,
        "iterations_run": iterations_run,
        "cost_usd": str(total_cost),
        "max_cost_usd": str(budget.max_cost_usd),
        "stop_reason": stop_reason,
        "context_engineering_run_id": str(context_eng_run_id),
    }


def _initial_prompt_attributes(
    project_description: str | None,
    entity_types: list[EntityTypeInfo],
) -> PromptAttributes:
    ordered_ids = [entity.entity_type_id for entity in entity_types if entity.entity_type_id]
    return PromptAttributes(
        project_description=project_description,
        entity_types_order=ordered_ids,
        entity_type_definitions={
            str(entity.entity_type_id): entity.user_definition or ""
            for entity in entity_types
            if entity.entity_type_id
        },
        entity_type_example_values={
            str(entity.entity_type_id): list(entity.user_examples)
            for entity in entity_types
            if entity.entity_type_id
        },
        entity_type_example_finds={str(entity_id): [] for entity_id in ordered_ids},
    )


async def _populate_example_finds(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attributes: PromptAttributes,
    entity_types: list[EntityTypeInfo],
    labeled_pdfs: list[LabeledPdf],
) -> Decimal:
    cost = Decimal("0")
    entity_by_id = {entity.entity_type_id: entity for entity in entity_types}
    for pdf in labeled_pdfs:
        text = pdf.full_text or ""
        for annotation in pdf.annotations:
            if annotation.entity_type_id is None:
                continue
            entity = entity_by_id.get(annotation.entity_type_id)
            if entity is None:
                continue
            window = _window_around_value(text, annotation.labeled_text)
            if window is None:
                continue
            prompt = (
                "Explain why the labelled value is an example of this entity type. "
                "Return JSON with keys context and explanation.\n\n"
                f"Entity type: {entity.name}\n"
                f"Definition: {attributes.entity_type_definitions.get(str(entity.entity_type_id), '')}\n"
                f"Labelled value: {annotation.labeled_text}\n"
                f"Text window:\n{window}"
            )
            response, usage_cost = await _call_prompt_engineering_model(
                conn,
                clients,
                provider=provider,
                model=model,
                project_id=project_id,
                system_prompt="You create concise NER few-shot example explanations.",
                user_prompt=prompt,
            )
            cost += usage_cost
            try:
                parsed = json.loads(response.text)
            except json.JSONDecodeError:
                parsed = {"context": window, "explanation": response.text}
            key = str(annotation.entity_type_id)
            attributes.entity_type_example_finds.setdefault(key, []).append(
                {
                    "pdf_id": str(pdf.pdf_id),
                    "value": annotation.labeled_text,
                    "context": str(parsed.get("context") or window),
                    "explanation": str(parsed.get("explanation") or ""),
                }
            )
    return cost


async def _modify_attributes_from_incorrect_predictions(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attributes: PromptAttributes,
    incorrect_entity_value_ids: list[UUID],
    missed_entity_types: list[dict],
) -> Decimal:
    rows = await repo.fetch_entity_values_by_ids(conn, incorrect_entity_value_ids)
    incorrect_values = _incorrect_values_payload(rows) if rows else []
    missed_info = missed_entity_types or []
    total_cost = Decimal("0")

    project_description, cost = await _determine_better_project_description_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    total_cost += cost
    if project_description is not None:
        attributes.project_description = project_description

    entity_types_order, cost = await _determine_better_entity_types_order_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    total_cost += cost
    if entity_types_order:
        attributes.entity_types_order = entity_types_order

    definitions, cost = await _determine_better_entity_definitions_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    total_cost += cost
    if definitions:
        attributes.entity_type_definitions.update(definitions)

    example_values, cost = await _determine_better_example_entity_values_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    total_cost += cost
    if example_values:
        attributes.entity_type_example_values.update(example_values)

    example_finds, cost = await _determine_better_example_entity_finds_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    total_cost += cost
    if example_finds:
        attributes.entity_type_example_finds.update(example_finds)
    return total_cost


async def _determine_better_project_description_candidate(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attributes: PromptAttributes,
    incorrect_values: list[dict],
    missed_info: list[dict],
) -> tuple[str | None, Decimal]:
    parsed, cost = await _determine_attribute_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attribute_name="project_description",
        instruction="Return a better project_description string or null.",
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    candidate = parsed.get("candidate")
    return (candidate if isinstance(candidate, str) else None), cost


async def _determine_better_entity_types_order_candidate(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attributes: PromptAttributes,
    incorrect_values: list[dict],
    missed_info: list[dict],
) -> tuple[list[UUID] | None, Decimal]:
    parsed, cost = await _determine_attribute_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attribute_name="entity_types_order",
        instruction=(
            "Return candidate as a UUID string list containing only existing entity type ids, "
            "or null."
        ),
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    candidate = parsed.get("candidate")
    if not isinstance(candidate, list):
        return None, cost
    allowed = {str(entity_id) for entity_id in attributes.entity_types_order}
    ordered = [UUID(value) for value in candidate if isinstance(value, str) and value in allowed]
    return (ordered or None), cost


async def _determine_better_entity_definitions_candidate(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attributes: PromptAttributes,
    incorrect_values: list[dict],
    missed_info: list[dict],
) -> tuple[dict[str, str] | None, Decimal]:
    parsed, cost = await _determine_attribute_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attribute_name="entity_type_definitions",
        instruction="Return candidate as an object of entity type UUID string to definition string.",
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    candidate = parsed.get("candidate")
    if not isinstance(candidate, dict):
        return None, cost
    allowed = set(attributes.entity_type_definitions)
    return {
        key: value for key, value in candidate.items() if key in allowed and isinstance(value, str)
    } or None, cost


async def _determine_better_example_entity_values_candidate(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attributes: PromptAttributes,
    incorrect_values: list[dict],
    missed_info: list[dict],
) -> tuple[dict[str, list[str]] | None, Decimal]:
    parsed, cost = await _determine_attribute_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attribute_name="entity_type_example_values",
        instruction=(
            "Return candidate as an object of entity type UUID string to string arrays. "
            "Use only values from current examples or incorrect predicted values."
        ),
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    candidate = parsed.get("candidate")
    if not isinstance(candidate, dict):
        return None, cost
    allowed = set(attributes.entity_type_example_values)
    result: dict[str, list[str]] = {}
    for key, values in candidate.items():
        if key in allowed and isinstance(values, list):
            result[key] = [str(value) for value in values if str(value).strip()]
    return result or None, cost


async def _determine_better_example_entity_finds_candidate(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attributes: PromptAttributes,
    incorrect_values: list[dict],
    missed_info: list[dict],
) -> tuple[dict[str, list[dict]] | None, Decimal]:
    parsed, cost = await _determine_attribute_candidate(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        attribute_name="entity_type_example_finds",
        instruction=(
            "Return candidate as an object of entity type UUID string to arrays of objects "
            "with context, value, explanation, and optional pdf_id."
        ),
        attributes=attributes,
        incorrect_values=incorrect_values,
        missed_info=missed_info,
    )
    candidate = parsed.get("candidate")
    if not isinstance(candidate, dict):
        return None, cost
    allowed = set(attributes.entity_type_example_finds)
    result: dict[str, list[dict]] = {}
    for key, values in candidate.items():
        if key in allowed and isinstance(values, list):
            result[key] = [value for value in values if isinstance(value, dict)]
    return result or None, cost


async def _determine_attribute_candidate(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    attribute_name: str,
    instruction: str,
    attributes: PromptAttributes,
    incorrect_values: list[dict],
    missed_info: list[dict],
) -> tuple[dict, Decimal]:
    missed_text = (
        f"\n\nMissed entity types (entity type had labels but NER produced no prediction):"
        f"\n{json.dumps(missed_info, indent=2)}"
        if missed_info
        else ""
    )
    prompt = (
        f"Determine a better candidate for {attribute_name} after reviewing incorrect "
        'NER predictions. Return only JSON shaped as {"candidate": ...}. '
        f"{instruction}\n\n"
        f"Current attributes:\n{json.dumps(_attrs_to_json(attributes), indent=2)}\n\n"
        f"Incorrect predicted core.entity_values:\n{json.dumps(incorrect_values, indent=2)}"
        f"{missed_text}"
    )
    response, cost = await _call_prompt_engineering_model(
        conn,
        clients,
        provider=provider,
        model=model,
        project_id=project_id,
        system_prompt="You improve one structured prompt attribute for NER.",
        user_prompt=prompt,
    )
    try:
        parsed = json.loads(response.text)
    except json.JSONDecodeError:
        logger.warning(
            "Prompt engineering model returned non-JSON candidate for %s", attribute_name
        )
        return {}, cost
    return parsed if isinstance(parsed, dict) else {}, cost


async def _call_prompt_engineering_model(
    conn: asyncpg.Connection,
    clients: dict[str, Any],
    *,
    provider: str,
    model: str,
    project_id: UUID,
    system_prompt: str,
    user_prompt: str,
) -> tuple[LLMResponseData, Decimal]:
    if provider == "openai":
        response = await call_openai(clients["openai"], model, system_prompt, user_prompt)
    elif provider == "anthropic":
        response = await call_anthropic(clients["anthropic"], model, system_prompt, user_prompt)
    elif provider == "gemini":
        response = await call_google_genai(
            clients["gemini"], model, system_prompt, user_prompt, json_response=True
        )
    else:
        raise ValueError(f"Unsupported model provider: {provider}")
    usage_cost = await record_llm_usage(
        conn,
        model=model,
        input_tokens=response.input_tokens,
        output_tokens=response.output_tokens,
        project_id=project_id,
        task_name=_TASK_NAME,
    )
    return response, usage_cost


def _window_around_value(text: str, value: str) -> str | None:
    index = text.lower().find(value.lower())
    if index < 0:
        return None
    start = max(index - 500, 0)
    end = min(index + len(value) + 500, len(text))
    return text[start:end]


def _incorrect_values_payload(rows) -> list[dict]:
    return [
        {
            "entity_value_id": str(row["id"]),
            "entity_type_id": str(row["entity_type_id"]),
            "entity_type": row["entity_type_name"],
            "pdf_id": str(row["pdf_id"]),
            "predicted_value": row["text_value"],
        }
        for row in rows
    ]


async def _insert_prompt_examples_for_attributes(
    conn: asyncpg.Connection,
    prompt_id: UUID,
    attributes: PromptAttributes,
) -> None:
    rows = []
    for entity_type_id, finds in attributes.entity_type_example_finds.items():
        for index, find in enumerate(finds):
            pdf_id = find.get("pdf_id")
            if pdf_id:
                rows.append((prompt_id, UUID(pdf_id), UUID(entity_type_id), index))
    if not rows:
        return
    await conn.executemany(
        """
        INSERT INTO workers.prompt_examples
            (prompt_id, pdf_id, entity_type_id, example_idx)
        VALUES ($1, $2, $3, $4)
        """,
        rows,
    )


def _ordered_entity_types(
    entity_types: list[EntityTypeInfo],
    entity_types_order: list[UUID],
) -> list[EntityTypeInfo]:
    by_id = {entity.entity_type_id: entity for entity in entity_types}
    return [by_id[entity_id] for entity_id in entity_types_order if entity_id in by_id]


def _attrs_to_json(attributes: PromptAttributes) -> dict:
    return {
        "project_description": attributes.project_description,
        "entity_types_order": [str(entity_id) for entity_id in attributes.entity_types_order],
        "entity_type_definitions": attributes.entity_type_definitions,
        "entity_type_example_values": attributes.entity_type_example_values,
        "entity_type_example_finds": attributes.entity_type_example_finds,
    }

from __future__ import annotations

from decimal import Decimal
from typing import Any

import asyncpg

from app.domains.ner_metrics.application.workflows import calculate_ner_run_metrics
from app.domains.ner_runs.application.workflows import execute_and_persist_ner_batch
from app.domains.ner_runs.domain.entities import NerRunOrigin
from app.domains.ner_runs.infrastructure.repositories import link_run_to_model_eval_iteration
from app.shared.infrastructure.prompts import ensure_prompt_full_text

from ..domain.entities import ModelEvalIterationResult
from ..infrastructure import repositories as repo
from .commands import EvaluateChatModels

_TASK_NAME = "chat_model_eval.evaluate_models"


def _report_progress(
    task: Any | None,
    phase: str,
    message: str,
    percent: int,
    **details: Any,
) -> None:
    if task is None:
        return
    task.update_state(
        state="PROGRESS",
        meta={"phase": phase, "message": message, "percent": percent, "details": details},
    )


async def evaluate_chat_models_workflow(
    conn: asyncpg.Connection,
    llm_clients: dict[str, Any],
    cmd: EvaluateChatModels,
    task: Any | None = None,
) -> dict:
    project = await repo.fetch_project_config(conn, cmd.project_id)
    if project is None:
        raise ValueError(f"Project not found or missing active prompt: {cmd.project_id}")

    system_prompt = await ensure_prompt_full_text(
        conn,
        project.active_prompt_id,
        cmd.project_id,
    )
    if not system_prompt:
        raise ValueError(f"Active prompt has no full_text: {project.active_prompt_id}")

    model_metadata = await repo.fetch_available_model_metadata(conn, cmd.chat_model_ids)
    missing_models = [model_id for model_id in cmd.chat_model_ids if model_id not in model_metadata]
    if missing_models:
        raise ValueError(f"Chat models are unavailable: {missing_models}")

    entity_types = await repo.fetch_entity_types(conn, cmd.project_id)
    if not entity_types:
        raise ValueError(f"No entity types for project: {cmd.project_id}")

    pdfs = await repo.fetch_labeled_pdf_inputs(
        conn,
        project_id=cmd.project_id,
        pdf_ids=cmd.pdf_ids,
    )
    found_pdf_ids = {pdf.pdf_id for pdf in pdfs}
    missing_pdf_ids = set(cmd.pdf_ids) - found_pdf_ids
    if missing_pdf_ids:
        raise ValueError(f"PDFs are invalid or missing labels/text: {sorted(missing_pdf_ids)}")

    run_id = await repo.insert_chat_model_eval_run(
        conn,
        project_id=cmd.project_id,
        beta=cmd.beta,
        pdf_ids=cmd.pdf_ids,
        chat_model_ids=cmd.chat_model_ids,
    )
    _report_progress(
        task,
        "data_fetched",
        f"Loaded {len(pdfs)} PDFs and {len(cmd.chat_model_ids)} models",
        10,
    )

    total_cost = Decimal("0")
    best_model_id: str | None = None
    best_overall_f = -1.0
    best_accuracy_score: float | None = None
    iterations: list[ModelEvalIterationResult] = []

    for index, model_id in enumerate(cmd.chat_model_ids):
        metadata = model_metadata[model_id]
        _report_progress(
            task,
            "model_eval",
            f"Evaluating {model_id}",
            min(90, 10 + int((index / len(cmd.chat_model_ids)) * 75)),
            model=model_id,
        )
        ner_result = await execute_and_persist_ner_batch(
            conn,
            llm_clients,
            provider=metadata.provider,
            model=model_id,
            project_id=cmd.project_id,
            prompt_id=project.active_prompt_id,
            origin=NerRunOrigin(),
            task_name=_TASK_NAME,
            schema_name="chat_model_eval",
            system_prompt=system_prompt,
            pdfs=pdfs,
            entity_types=entity_types,
        )
        total_cost += ner_result.cost_usd
        metrics = await calculate_ner_run_metrics(
            conn,
            project_id=cmd.project_id,
            pdf_ids=cmd.pdf_ids,
            pdf_results=ner_result.pdf_results,
            entity_types=entity_types,
            beta=cmd.beta,
        )
        iteration_id = await repo.insert_chat_model_eval_iteration(
            conn,
            run_id=run_id,
            model_id=model_id,
            prompt_id=project.active_prompt_id,
            accumulated_usd=ner_result.cost_usd,
            overall_f=metrics.overall_f,
            per_entity_scores=metrics.per_entity_scores,
            num_correct_pdfs=metrics.num_correct_pdfs,
            pdf_accuracy=metrics.pdf_accuracy,
            entity_type_metrics=metrics.entity_type_metrics,
            incorrectly_predicted_entity_value_ids=metrics.incorrectly_predicted_entity_value_ids,
        )
        if ner_result.run_id is not None:
            await link_run_to_model_eval_iteration(
                conn,
                ner_run_id=ner_result.run_id,
                model_eval_iter_id=iteration_id,
            )
        iterations.append(
            ModelEvalIterationResult(
                iteration_id=iteration_id,
                ner_run_id=ner_result.run_id,
                model_id=model_id,
                overall_f=metrics.overall_f,
                accuracy_score=metrics.accuracy_score,
                cost_usd=str(ner_result.cost_usd),
            )
        )
        if metrics.overall_f > best_overall_f:
            best_overall_f = metrics.overall_f
            best_accuracy_score = metrics.accuracy_score
            best_model_id = model_id

    if best_model_id is None:
        raise ValueError("No chat models were evaluated")

    await repo.complete_chat_model_eval_run(
        conn,
        run_id=run_id,
        best_model_id=best_model_id,
        best_overall_f=best_overall_f,
        best_accuracy_score=best_accuracy_score,
        accumulated_usd=total_cost,
    )
    _report_progress(task, "complete", "Chat model evaluation complete", 100)
    return {
        "chat_model_eval_run_id": str(run_id),
        "best_model_id": best_model_id,
        "best_f": best_overall_f,
        "accuracy_score": best_accuracy_score,
        "iterations": [
            {
                "iteration_id": str(iteration.iteration_id),
                "ner_run_id": str(iteration.ner_run_id) if iteration.ner_run_id else None,
                "model_id": iteration.model_id,
                "overall_f": iteration.overall_f,
                "accuracy_score": iteration.accuracy_score,
                "cost_usd": iteration.cost_usd,
            }
            for iteration in iterations
        ],
    }

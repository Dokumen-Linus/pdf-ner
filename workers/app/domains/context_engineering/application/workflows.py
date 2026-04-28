from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg
from openai import AsyncOpenAI

from app.domains.billing.application.workflows import report_usage_to_stripe
from app.domains.billing.infrastructure.repository import record_llm_usage
from app.integrations.openai import call_openai
from app.shared.domain.LLMResponseData import LLMResponseData

from ..domain import services
from ..domain.entities import (
    EntityTypeInfo,
    EvaluationResult,
    FinalPdfEvaluation,
    FinalPredictionPair,
    LabeledPdf,
    PromptCandidate,
)
from ..domain.value_objects import CostBudget
from ..infrastructure import repositories as repo
from .commands import OptimizePrompt

logger = logging.getLogger(__name__)

_TASK_NAME = "context_engineering.optimize_prompt"


def _report_progress(
    task: Any | None, phase: str, message: str, percent: int, **details: Any
) -> None:
    """Push a PROGRESS state update to the Celery result backend."""
    if task is None:
        return
    task.update_state(
        state="PROGRESS",
        meta={
            "phase": phase,
            "message": message,
            "percent": percent,
            "details": details,
        },
    )


def _budget_details(budget: CostBudget) -> dict[str, str]:
    return {
        "cost_usd": str(budget.spent_cost_usd),
        "max_cost_usd": str(budget.max_cost_usd),
        "remaining_cost_usd": str(budget.remaining_cost_usd),
    }


def _budget_percent(budget: CostBudget, floor: int = 10, ceiling: int = 95) -> int:
    ratio = min(float(budget.spent_cost_usd / budget.max_cost_usd), 1.0)
    return min(ceiling, max(floor, floor + int(ratio * (ceiling - floor))))


async def prompt_optimization_workflow(
    conn: asyncpg.Connection,
    openai_client: AsyncOpenAI,
    cmd: OptimizePrompt,
    task: Any | None = None,
) -> dict:
    """Main optimization loop.

    Returns dict with best_prompt_id, best_f1, iterations_run, cost_usd, and stop_reason.
    """
    budget = CostBudget(max_cost_usd=cmd.max_cost_usd)
    stop_reason = "completed"
    iterations_run = 0
    llm_call_count = 0

    # 1. Fetch project data
    project = await repo.fetch_project(conn, cmd.project_id)
    if not project:
        raise ValueError(f"Project not found: {cmd.project_id}")

    model_provider = await repo.fetch_model_provider(conn, cmd.model)
    if model_provider is None:
        raise ValueError(f"Model is not available: {cmd.model}")
    if model_provider != "openai":
        raise ValueError(f"Context engineering requires an OpenAI model, got: {model_provider}")

    entity_types = await repo.fetch_entity_types_with_std(conn, cmd.project_id)
    if not entity_types:
        raise ValueError(f"No entity types for project: {cmd.project_id}")

    labeled_pdfs = await repo.fetch_labeled_pdfs(conn, cmd.project_id)
    if not labeled_pdfs:
        raise ValueError(f"No labeled PDFs for project: {cmd.project_id}")

    labeled_pdf_count = len(labeled_pdfs)
    labeled_pdfs, skipped_pdf_count = _usable_labeled_pdfs(labeled_pdfs)

    if not labeled_pdfs:
        raise ValueError(f"No labeled PDFs with usable text for project: {cmd.project_id}")

    # Split: first 2 for few-shot examples, rest for evaluation
    few_shot_pdfs = labeled_pdfs[:2]
    eval_pdfs = labeled_pdfs[2:] if len(labeled_pdfs) > 2 else labeled_pdfs

    _report_progress(
        task,
        "data_fetched",
        f"Loaded {len(labeled_pdfs)} PDFs and {len(entity_types)} entity types",
        5,
        pdfs_loaded=len(labeled_pdfs),
        entity_types_count=len(entity_types),
    )

    # 2. Build JSON response schema
    json_schema = services.build_json_schema(entity_types)

    # 3. Generate initial prompt variants
    base_prompt = services.build_base_system_prompt(project["description"], entity_types)
    few_shot_text = services.format_few_shot_examples(few_shot_pdfs)
    variants = services.generate_prompt_variants(base_prompt, entity_types, project["description"])

    _report_progress(
        task,
        "prompts_prepared",
        f"Generated {len(variants)} prompt variants",
        10,
        variants_count=len(variants),
    )

    # 4. Evaluate each variant, pick best
    best_candidate: PromptCandidate | None = None
    best_f1 = -1.0
    eval_results: list[EvaluationResult] = []

    for var_idx, system_prompt in enumerate(variants):
        if budget.is_exhausted:
            stop_reason = "max_cost_reached"
            break

        full_prompt = system_prompt
        if few_shot_text:
            full_prompt = system_prompt + "\n\n" + few_shot_text

        candidate = PromptCandidate(system_prompt=full_prompt, iteration=0)
        eval_results = await _evaluate_prompt_on_pdfs(
            conn,
            openai_client,
            candidate,
            eval_pdfs,
            json_schema,
            entity_types,
            cmd.model,
            project_id=cmd.project_id,
            budget=budget,
        )
        llm_call_count += len(eval_results)
        if not eval_results:
            stop_reason = "max_cost_reached"
            break
        avg_f1 = sum(r.overall_f1 for r in eval_results) / max(len(eval_results), 1)
        candidate.overall_f1 = avg_f1
        logger.info("Variant %d F1: %.4f", var_idx, avg_f1)

        variant_percent = max(
            15 + (var_idx * 30 // max(len(variants) - 1, 1)),
            _budget_percent(budget, floor=15, ceiling=45),
        )
        _report_progress(
            task,
            "evaluating_variant",
            f"Evaluated variant {var_idx + 1}/{len(variants)} - F1: {avg_f1:.3f}",
            variant_percent,
            variant=var_idx + 1,
            total_variants=len(variants),
            f1=round(avg_f1, 4),
            **_budget_details(budget),
        )

        if avg_f1 > best_f1:
            best_f1 = avg_f1
            best_candidate = candidate

    if best_candidate is None:
        raise ValueError("Cost budget exhausted before any prompt could be evaluated")

    # 5. Iterative refinement
    iteration = 0
    while not budget.is_exhausted:
        iteration += 1
        iter_base_pct = _budget_percent(budget, floor=50, ceiling=95)
        _report_progress(
            task,
            "evaluating_current",
            f"Iteration {iteration} - evaluating current best",
            iter_base_pct,
            iteration=iteration,
            best_f1=round(best_f1, 4),
            **_budget_details(budget),
        )

        eval_results = await _evaluate_prompt_on_pdfs(
            conn,
            openai_client,
            best_candidate,
            eval_pdfs,
            json_schema,
            entity_types,
            cmd.model,
            project_id=cmd.project_id,
            budget=budget,
        )
        llm_call_count += len(eval_results)
        if not eval_results:
            stop_reason = "max_cost_reached"
            break

        error_analysis = services.build_error_analysis(eval_results, entity_types)
        if not error_analysis.strip():
            logger.info("No errors to fix at iteration %d. Stopping.", iteration)
            stop_reason = "no_errors"
            break

        if budget.is_exhausted:
            stop_reason = "max_cost_reached"
            break

        _report_progress(
            task,
            "generating_refinement",
            f"Iteration {iteration} - generating refined prompt",
            _budget_percent(budget, floor=55, ceiling=95),
            iteration=iteration,
            **_budget_details(budget),
        )

        refinement_meta_prompt = services.build_refinement_prompt(
            best_candidate.system_prompt, error_analysis, entity_types
        )
        llm_usage: LLMResponseData = await call_openai(
            openai_client,
            cmd.model,
            "You are a prompt engineering expert.",
            refinement_meta_prompt,
        )
        usage_cost = await record_llm_usage(
            conn,
            model=cmd.model,
            input_tokens=llm_usage.input_tokens,
            output_tokens=llm_usage.output_tokens,
            project_id=cmd.project_id,
            task_name=_TASK_NAME,
        )
        budget.add_usage(usage_cost)
        llm_call_count += 1

        if budget.is_exhausted:
            stop_reason = "max_cost_reached"
            break

        refined_candidate = PromptCandidate(system_prompt=llm_usage.text, iteration=iteration)
        refined_results = await _evaluate_prompt_on_pdfs(
            conn,
            openai_client,
            refined_candidate,
            eval_pdfs,
            json_schema,
            entity_types,
            cmd.model,
            project_id=cmd.project_id,
            budget=budget,
        )
        llm_call_count += len(refined_results)
        if not refined_results:
            stop_reason = "max_cost_reached"
            break
        refined_f1 = sum(r.overall_f1 for r in refined_results) / max(len(refined_results), 1)
        refined_candidate.overall_f1 = refined_f1
        refined_candidate.scores = {
            et.name: _avg_score(refined_results, et.name) for et in entity_types
        }
        logger.info(
            "Iteration %d refined F1: %.4f (best so far: %.4f)",
            iteration,
            refined_f1,
            best_f1,
        )

        _report_progress(
            task,
            "iteration_evaluated",
            f"Iteration {iteration} - refined F1: {refined_f1:.3f}",
            _budget_percent(budget, floor=60, ceiling=95),
            iteration=iteration,
            refined_f1=round(refined_f1, 4),
            best_f1=round(best_f1, 4),
            **_budget_details(budget),
        )

        iterations_run = iteration
        improvement = refined_f1 - best_f1
        if refined_f1 > best_f1:
            best_f1 = refined_f1
            best_candidate = refined_candidate

        if improvement < cmd.convergence_threshold:
            logger.info(
                "Converged at iteration %d (improvement %.4f < threshold %.4f)",
                iteration,
                improvement,
                cmd.convergence_threshold,
            )
            stop_reason = "converged"
            break

    if budget.is_exhausted and stop_reason == "completed":
        stop_reason = "max_cost_reached"

    # 6. Store best prompt and scores
    _report_progress(
        task,
        "storing_results",
        "Saving optimized prompt and evaluation scores",
        98,
        best_f1=round(best_f1, 4),
        stop_reason=stop_reason,
        **_budget_details(budget),
    )

    prompt_id = await repo.insert_optimized_prompt(
        conn, cmd.project_id, best_candidate.system_prompt
    )
    final_results, final_eval_results, final_pairs, final_llm_calls, final_skipped_count = (
        await _evaluate_final_prompt_on_pdfs(
            conn,
            openai_client,
            best_candidate,
            labeled_pdfs,
            json_schema,
            entity_types,
            cmd.model,
            project_id=cmd.project_id,
            prompt_id=prompt_id,
            budget=budget,
        )
    )
    llm_call_count += final_llm_calls
    skipped_pdf_count += final_skipped_count
    final_metrics = services.build_final_run_metrics(
        final_results,
        entity_types,
        labeled_pdf_count=labeled_pdf_count,
        skipped_pdf_count=skipped_pdf_count,
    )
    per_entity_scores = {et.name: _avg_score(final_eval_results, et.name) for et in entity_types}
    final_f1 = (
        sum(r.overall_f1 for r in final_eval_results) / len(final_eval_results)
        if final_eval_results
        else 0.0
    )
    best_candidate.scores = per_entity_scores

    evaluation_id = await repo.insert_evaluation(
        conn,
        prompt_id,
        final_f1,
        per_entity_scores,
        model_id=cmd.model,
        labeled_pdf_count=final_metrics["labeled_pdf_count"],
        evaluated_pdf_count=final_metrics["evaluated_pdf_count"],
        skipped_pdf_count=final_metrics["skipped_pdf_count"],
        pdfs_fully_correct=final_metrics["pdfs_fully_correct"],
        pdf_accuracy=final_metrics["pdf_accuracy"],
        entity_type_metrics=final_metrics["entity_type_metrics"],
        llm_call_count=llm_call_count,
        cost_usd=budget.spent_cost_usd,
        iterations_run=iterations_run,
        stop_reason=stop_reason,
    )
    await repo.insert_context_engineering_predictions(conn, evaluation_id, final_pairs)
    await report_usage_to_stripe(cmd.project_id)

    return {
        "best_prompt_id": str(prompt_id),
        "best_f1": final_f1,
        "iterations_run": iterations_run,
        "cost_usd": str(budget.spent_cost_usd),
        "max_cost_usd": str(budget.max_cost_usd),
        "stop_reason": stop_reason,
        "prompt_evaluation_id": str(evaluation_id),
        "llm_call_count": llm_call_count,
        "pdf_accuracy": final_metrics["pdf_accuracy"],
    }


def _usable_labeled_pdfs(labeled_pdfs: list[LabeledPdf]) -> tuple[list[LabeledPdf], int]:
    usable: list[LabeledPdf] = []
    skipped_count = 0
    for pdf in labeled_pdfs:
        try:
            if not pdf.full_text or not pdf.full_text.strip():
                raise ValueError("labeled PDF has no saved full_text")
            if not any(annotation.labeled_text.strip() for annotation in pdf.annotations):
                raise ValueError("labeled PDF has no usable annotation text")
        except ValueError:
            skipped_count += 1
            logger.exception("Skipping labeled PDF %s during context engineering", pdf.pdf_id)
            continue
        usable.append(pdf)
    return usable, skipped_count


async def _evaluate_final_prompt_on_pdfs(
    conn: asyncpg.Connection,
    openai_client: AsyncOpenAI,
    candidate: PromptCandidate,
    labeled_pdfs: list[LabeledPdf],
    json_schema: dict,
    entity_types: list[EntityTypeInfo],
    model: str,
    *,
    project_id: UUID,
    prompt_id: UUID,
    budget: CostBudget,
) -> tuple[list[FinalPdfEvaluation], list[EvaluationResult], list[FinalPredictionPair], int, int]:
    final_results: list[FinalPdfEvaluation] = []
    eval_results: list[EvaluationResult] = []
    pairs: list[FinalPredictionPair] = []
    llm_call_count = 0
    skipped_count = 0

    for pdf in labeled_pdfs:
        try:
            llm_usage: LLMResponseData = await call_openai(
                openai_client,
                model,
                candidate.system_prompt,
                pdf.full_text or "",
                schema=json_schema,
                schema_name="ner_extraction",
            )
            llm_call_count += 1
            usage_cost = await record_llm_usage(
                conn,
                model=model,
                input_tokens=llm_usage.input_tokens,
                output_tokens=llm_usage.output_tokens,
                project_id=project_id,
                task_name=_TASK_NAME,
            )
            budget.add_usage(usage_cost)
            try:
                predicted = json.loads(llm_usage.text)
            except json.JSONDecodeError:
                logger.warning("Invalid final-run JSON from LLM for PDF %s", pdf.pdf_id)
                predicted = {}

            await repo.update_pdf_final_predictions(
                conn,
                pdf_id=pdf.pdf_id,
                optimized_prompt_id=prompt_id,
                model=model,
                predicted=predicted,
            )
            eval_result = services.evaluate_predictions(predicted, pdf.ground_truth, entity_types)
            eval_result.prompt_candidate = candidate
            final_result = services.evaluate_final_pdf_predictions(pdf, predicted, entity_types)
        except Exception:
            skipped_count += 1
            logger.exception("Skipping final context engineering result for PDF %s", pdf.pdf_id)
            continue

        eval_results.append(eval_result)
        final_results.append(final_result)
        pairs.extend(final_result.pairs)

    return final_results, eval_results, pairs, llm_call_count, skipped_count


async def _evaluate_prompt_on_pdfs(
    conn: asyncpg.Connection,
    openai_client: AsyncOpenAI,
    candidate: PromptCandidate,
    eval_pdfs: list[LabeledPdf],
    json_schema: dict,
    entity_types: list[EntityTypeInfo],
    model: str,
    *,
    project_id: UUID,
    budget: CostBudget,
) -> list[EvaluationResult]:
    """Run NER with the candidate prompt on each eval PDF and evaluate."""
    results: list[EvaluationResult] = []
    for pdf in eval_pdfs:
        if budget.is_exhausted:
            break

        try:
            llm_usage: LLMResponseData = await call_openai(
                openai_client,
                model,
                candidate.system_prompt,
                pdf.full_text or "",
                schema=json_schema,
                schema_name="ner_extraction",
            )
            usage_cost = await record_llm_usage(
                conn,
                model=model,
                input_tokens=llm_usage.input_tokens,
                output_tokens=llm_usage.output_tokens,
                project_id=project_id,
                task_name=_TASK_NAME,
            )
            budget.add_usage(usage_cost)
            try:
                predicted = json.loads(llm_usage.text)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from LLM for PDF %s", pdf.pdf_id)
                predicted = {}

            result = services.evaluate_predictions(predicted, pdf.ground_truth, entity_types)
            result.prompt_candidate = candidate
            results.append(result)
        except Exception as exc:
            logger.warning("Failed to evaluate prompt for pdf=%s: %s", pdf.pdf_id, exc, exc_info=True)
            continue

    return results


def _avg_score(results: list[EvaluationResult], entity_name: str):
    """Average F1Score for an entity type across multiple evaluation results."""
    from ..domain.value_objects import F1Score

    scores = [
        r.per_entity_scores[entity_name] for r in results if entity_name in r.per_entity_scores
    ]
    if not scores:
        return F1Score(precision=0.0, recall=0.0, f1=0.0)
    return F1Score(
        precision=sum(s.precision for s in scores) / len(scores),
        recall=sum(s.recall for s in scores) / len(scores),
        f1=sum(s.f1 for s in scores) / len(scores),
    )

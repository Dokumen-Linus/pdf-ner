from __future__ import annotations

import json
import logging

import asyncpg
from openai import AsyncOpenAI
from app.domains.billing.infrastructure.repository import record_llm_usage
from app.integrations.openai import call_openai
from app.shared.domain.LLMResponseData import LLMResponseData
from app.shared.infrastructure.s3 import download_pdf_bytes

from ..domain import services
from ..domain.entities import EntityTypeInfo, EvaluationResult, LabeledPdf, PromptCandidate
from ..infrastructure import repositories as repo
from .commands import OptimizePrompt

logger = logging.getLogger(__name__)

_TASK_NAME = "context_engineering.optimize_prompt"


async def prompt_optimization_workflow(
    conn: asyncpg.Connection,
    openai_client: AsyncOpenAI,
    cmd: OptimizePrompt,
) -> dict:
    """Main optimization loop.

    Returns dict with best_prompt_id, best_f1, iterations_run.
    """
    # 1. Fetch project data
    project = await repo.fetch_project(conn, cmd.project_id)
    if not project:
        raise ValueError(f"Project not found: {cmd.project_id}")

    entity_types = await repo.fetch_entity_types_with_std(conn, cmd.project_id)
    if not entity_types:
        raise ValueError(f"No entity types for project: {cmd.project_id}")

    labeled_pdfs = await repo.fetch_labeled_pdfs(conn, cmd.project_id)
    if not labeled_pdfs:
        raise ValueError(f"No labeled PDFs for project: {cmd.project_id}")

    # For PDFs without extracted text, attempt S3 download.
    # PDFs that fail download or have no text are skipped.
    usable_pdfs: list[LabeledPdf] = []
    for pdf in labeled_pdfs:
        if pdf.full_text is not None:
            usable_pdfs.append(pdf)
            continue
        try:
            _data, _filepath = await download_pdf_bytes(conn, pdf.pdf_id)
            logger.warning(
                "PDF %s: downloaded from S3 (key=%s) but text extraction from raw bytes "
                "not yet implemented — skipping",
                pdf.pdf_id,
                _filepath,
            )
        except Exception as exc:
            logger.warning(
                "PDF %s: S3 download failed — skipping (error=%s)",
                pdf.pdf_id,
                exc,
                exc_info=True,
            )
    labeled_pdfs = usable_pdfs

    if not labeled_pdfs:
        raise ValueError(f"No labeled PDFs with usable text for project: {cmd.project_id}")

    # Split: first 2 for few-shot examples, rest for evaluation
    few_shot_pdfs = labeled_pdfs[:2]
    eval_pdfs = labeled_pdfs[2:] if len(labeled_pdfs) > 2 else labeled_pdfs

    # 2. Build JSON response schema
    json_schema = services.build_json_schema(entity_types)

    # 3. Generate initial prompt variants
    base_prompt = services.build_base_system_prompt(project["description"], entity_types)
    few_shot_text = services.format_few_shot_examples(few_shot_pdfs)
    variants = services.generate_prompt_variants(base_prompt, entity_types, project["description"])

    # 4. Evaluate each variant, pick best
    best_candidate: PromptCandidate | None = None
    best_f1 = -1.0

    for var_idx, system_prompt in enumerate(variants):
        full_prompt = system_prompt
        if few_shot_text:
            full_prompt = system_prompt + "\n\n" + few_shot_text

        candidate = PromptCandidate(system_prompt=full_prompt, iteration=0)
        eval_results = await _evaluate_prompt_on_pdfs(
            openai_client,
            candidate,
            eval_pdfs,
            json_schema,
            entity_types,
            cmd.model,
        )
        avg_f1 = sum(r.overall_f1 for r in eval_results) / max(len(eval_results), 1)
        candidate.overall_f1 = avg_f1
        logger.info("Variant %d F1: %.4f", var_idx, avg_f1)

        if avg_f1 > best_f1:
            best_f1 = avg_f1
            best_candidate = candidate

    # 5. Iterative refinement
    for iteration in range(1, cmd.max_iterations + 1):
        eval_results = await _evaluate_prompt_on_pdfs(
            openai_client,
            best_candidate,
            eval_pdfs,
            json_schema,
            entity_types,
            cmd.model,
        )

        error_analysis = services.build_error_analysis(eval_results, entity_types)
        if not error_analysis.strip():
            logger.info("No errors to fix at iteration %d. Stopping.", iteration)
            break

        refinement_meta_prompt = services.build_refinement_prompt(
            best_candidate.system_prompt, error_analysis, entity_types
        )
        llm_usage: LLMResponseData = await call_openai(
            openai_client,
            cmd.refinement_model,
            "You are a prompt engineering expert.",
            refinement_meta_prompt,
        )
        await record_llm_usage(
            conn,
            provider="openai",
            model=cmd.refinement_model,
            input_tokens=llm_usage.input_tokens,
            output_tokens=llm_usage.output_tokens,
            project_id=cmd.project_id,
            task_name=_TASK_NAME,
        )

        refined_candidate = PromptCandidate(system_prompt=llm_usage.text, iteration=iteration)
        refined_results = await _evaluate_prompt_on_pdfs(
            openai_client,
            refined_candidate,
            eval_pdfs,
            json_schema,
            entity_types,
            cmd.model,
        )
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
            break

    # 6. Store best prompt and scores
    per_entity_scores = {et.name: _avg_score(eval_results, et.name) for et in entity_types}
    best_candidate.scores = per_entity_scores

    prompt_id = await repo.insert_optimized_prompt(
        conn, cmd.project_id, best_candidate.system_prompt
    )
    await repo.insert_evaluation(conn, prompt_id, best_f1, per_entity_scores)

    return {
        "best_prompt_id": str(prompt_id),
        "best_f1": best_f1,
        "iterations_run": best_candidate.iteration,
    }


async def _evaluate_prompt_on_pdfs(
    openai_client: AsyncOpenAI,
    candidate: PromptCandidate,
    eval_pdfs: list[LabeledPdf],
    json_schema: dict,
    entity_types: list[EntityTypeInfo],
    model: str,
) -> list[EvaluationResult]:
    """Run NER with the candidate prompt on each eval PDF and evaluate."""
    results: list[EvaluationResult] = []
    for pdf in eval_pdfs:
        llm_usage: LLMResponseData = await call_openai(
            openai_client,
            model,
            candidate.system_prompt,
            pdf.full_text or "",
            schema=json_schema,
            schema_name="ner_extraction",
        )
        try:
            predicted = json.loads(llm_usage.text)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON from LLM for PDF %s", pdf.pdf_id)
            predicted = {}

        result = services.evaluate_predictions(predicted, pdf.ground_truth, entity_types)
        result.prompt_candidate = candidate
        results.append(result)

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

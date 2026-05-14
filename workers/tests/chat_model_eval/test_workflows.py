from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.domains.chat_model_eval.application import workflows
from app.domains.chat_model_eval.application.commands import EvaluateChatModels
from app.domains.chat_model_eval.domain.entities import ModelMetadata, ProjectModelEvalConfig
from app.domains.ner_metrics.domain.entities import MetricsResult
from app.domains.ner_metrics.domain.value_objects import FScore
from app.domains.ner_runs.domain.entities import (
    EntityTypeInfo,
    NerBatchResult,
    NerPdfInput,
    NerPdfResult,
)


@pytest.mark.anyio
async def test_evaluate_chat_models_persists_iteration_and_completes_run():
    conn = AsyncMock()
    project_id = uuid4()
    prompt_id = uuid4()
    pdf_id = uuid4()
    run_id = uuid4()
    iteration_id = 42
    ner_run_id = uuid4()
    entity_type = EntityTypeInfo(
        name="invoice_id",
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
    ner_result = NerBatchResult(
        run_id=ner_run_id,
        pdf_results=[NerPdfResult(pdf_id=pdf_id, predictions={"invoice_id": "INV-1"})],
        cost_usd=Decimal("0.02"),
        input_tokens=1,
        output_tokens=1,
    )
    metrics = MetricsResult(
        overall_f=1.0,
        per_entity_scores={"invoice_id": FScore(1.0, 1.0, 1.0)},
        num_correct_pdfs=1,
        accuracy_score=1.0,
        entity_type_metrics={"invoice_id": {"precision": 1.0, "recall": 1.0, "f": 1.0}},
    )
    cmd = EvaluateChatModels(
        project_id=project_id,
        pdf_ids=[pdf_id],
        chat_model_ids=["gpt-5.4-mini"],
    )

    with (
        patch.object(
            workflows.repo,
            "fetch_project_config",
            new=AsyncMock(return_value=ProjectModelEvalConfig(project_id, prompt_id)),
        ),
        patch.object(workflows.repo, "fetch_prompt_text", new=AsyncMock(return_value="prompt")),
        patch.object(
            workflows.repo,
            "fetch_available_model_metadata",
            new=AsyncMock(return_value={"gpt-5.4-mini": ModelMetadata("gpt-5.4-mini", "openai")}),
        ),
        patch.object(
            workflows.repo, "fetch_entity_types", new=AsyncMock(return_value=[entity_type])
        ),
        patch.object(
            workflows.repo,
            "fetch_labeled_pdf_inputs",
            new=AsyncMock(return_value=[NerPdfInput(pdf_id, "text", 1)]),
        ),
        patch.object(
            workflows.repo,
            "insert_chat_model_eval_run",
            new=AsyncMock(return_value=run_id),
        ),
        patch.object(
            workflows.repo,
            "insert_chat_model_eval_iteration",
            new=AsyncMock(return_value=iteration_id),
        ) as insert_iteration,
        patch.object(workflows.repo, "complete_chat_model_eval_run", new=AsyncMock()) as complete,
        patch.object(
            workflows,
            "execute_and_persist_ner_batch",
            new=AsyncMock(return_value=ner_result),
        ),
        patch.object(workflows, "calculate_ner_run_metrics", new=AsyncMock(return_value=metrics)),
        patch.object(workflows, "link_run_to_model_eval_iteration", new=AsyncMock()) as link_run,
    ):
        result = await workflows.evaluate_chat_models_workflow(conn, {"openai": object()}, cmd)

    assert result["chat_model_eval_run_id"] == str(run_id)
    assert result["best_model_id"] == "gpt-5.4-mini"
    assert result["best_f"] == 1.0
    assert result["accuracy_score"] == 1.0
    insert_iteration.assert_awaited_once()
    link_run.assert_awaited_once_with(
        conn,
        ner_run_id=ner_run_id,
        model_eval_iter_id=iteration_id,
    )
    complete.assert_awaited_once()

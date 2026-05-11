from decimal import Decimal
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.domains.context_engineering.application.commands import OptimizePrompt
from app.domains.context_engineering.application.workflows import (
    _avg_score,
    _evaluate_prompt_on_pdfs,
    prompt_optimization_workflow,
)
from app.domains.context_engineering.domain.entities import (
    EvaluationResult,
    PromptCandidate,
)
from app.domains.context_engineering.domain.value_objects import CostBudget, F1Score
from tests.conftest import PDF_ID_1, PROJECT_ID, PROMPT_ID

BUCKET_ID = uuid4()
TEMPLATE_ID = 1
TEMPLATE_ROW = {
    "id": TEMPLATE_ID,
    "txt": (
        "Project: <PROJECT_DESCRIPTION>\nFields: <ENTITY_TYPES>\nDefinitions: <DEFINITIONS>\n"
        "Examples: <EXAMPLE_VALUES>\nConstraints: <CONSTRAINTS>\nRequired: <IS_REQUIRED>\n"
        "Unique: <IS_UNIQUE>\nDocument:"
    ),
    "inserts": [
        "<PROJECT_DESCRIPTION>",
        "<ENTITY_TYPES>",
        "<DEFINITIONS>",
        "<EXAMPLE_VALUES>",
        "<CONSTRAINTS>",
        "<IS_REQUIRED>",
        "<IS_UNIQUE>",
    ],
    "document_at_end": True,
}

# ─── _avg_score ──────────────────────────────────────────────────────────


class TestAvgScore:
    def test_single_result(self):
        result = EvaluationResult(
            prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
            per_entity_scores={"name": F1Score(0.8, 0.9, 0.85)},
            overall_exact_match_rate=0.8,
            overall_partial_match_rate=0.9,
            overall_f1=0.85,
            errors=[],
        )
        avg = _avg_score([result], "name")
        assert avg.precision == pytest.approx(0.8)
        assert avg.recall == pytest.approx(0.9)
        assert avg.f1 == pytest.approx(0.85)

    def test_multiple_results_averaged(self):
        results = [
            EvaluationResult(
                prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
                per_entity_scores={"name": F1Score(0.8, 0.6, 0.7)},
                overall_exact_match_rate=0.0,
                overall_partial_match_rate=0.0,
                overall_f1=0.7,
                errors=[],
            ),
            EvaluationResult(
                prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
                per_entity_scores={"name": F1Score(1.0, 1.0, 1.0)},
                overall_exact_match_rate=1.0,
                overall_partial_match_rate=1.0,
                overall_f1=1.0,
                errors=[],
            ),
        ]
        avg = _avg_score(results, "name")
        assert avg.precision == pytest.approx(0.9)
        assert avg.recall == pytest.approx(0.8)
        assert avg.f1 == pytest.approx(0.85)

    def test_missing_entity_returns_zero(self):
        result = EvaluationResult(
            prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
            per_entity_scores={"other": F1Score(1.0, 1.0, 1.0)},
            overall_exact_match_rate=1.0,
            overall_partial_match_rate=1.0,
            overall_f1=1.0,
            errors=[],
        )
        avg = _avg_score([result], "name")
        assert avg.f1 == 0.0


# ─── _evaluate_prompt_on_pdfs ────────────────────────────────────────────


class TestEvaluatePromptOnPdfs:
    @pytest.mark.anyio
    async def test_evaluates_each_pdf(self, entity_types, labeled_pdf_1, labeled_pdf_2):
        mock_client = AsyncMock()
        perfect_response = json.dumps(
            {
                "full_name": "John Smith",
                "ssn": "123-45-6789",
                "phone_numbers": ["555-1234", "555-5678"],
            }
        )
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=perfect_response))]
        )

        candidate = PromptCandidate(system_prompt="test prompt", iteration=0)
        json_schema = {"type": "object", "properties": {}}
        conn = AsyncMock()
        budget = CostBudget(max_cost_usd=Decimal("1.00"))

        with patch(
            "app.domains.context_engineering.application.workflows.record_llm_usage",
            new=AsyncMock(return_value=Decimal("0.01")),
        ):
            results = await _evaluate_prompt_on_pdfs(
                conn,
                mock_client,
                candidate,
                [labeled_pdf_1],
                json_schema,
                entity_types,
                "gpt-4o",
                project_id=PROJECT_ID,
                budget=budget,
            )

        assert len(results) == 1
        assert results[0].overall_f1 == 1.0
        assert mock_client.chat.completions.create.call_count == 1
        assert budget.spent_cost_usd == Decimal("0.01")

    @pytest.mark.anyio
    async def test_handles_invalid_json(self, entity_types, labeled_pdf_1):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="not valid json"))]
        )

        candidate = PromptCandidate(system_prompt="test", iteration=0)
        conn = AsyncMock()
        budget = CostBudget(max_cost_usd=Decimal("1.00"))
        with patch(
            "app.domains.context_engineering.application.workflows.record_llm_usage",
            new=AsyncMock(return_value=Decimal("0.01")),
        ):
            results = await _evaluate_prompt_on_pdfs(
                conn,
                mock_client,
                candidate,
                [labeled_pdf_1],
                {},
                entity_types,
                "gpt-4o",
                project_id=PROJECT_ID,
                budget=budget,
            )

        assert len(results) == 1
        # Invalid JSON -> empty predictions -> low F1
        assert results[0].overall_f1 < 1.0

    @pytest.mark.anyio
    async def test_multiple_pdfs(self, entity_types, labeled_pdf_1, labeled_pdf_2):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="{}"))]
        )

        candidate = PromptCandidate(system_prompt="test", iteration=0)
        conn = AsyncMock()
        budget = CostBudget(max_cost_usd=Decimal("1.00"))
        with patch(
            "app.domains.context_engineering.application.workflows.record_llm_usage",
            new=AsyncMock(return_value=Decimal("0.01")),
        ):
            results = await _evaluate_prompt_on_pdfs(
                conn,
                mock_client,
                candidate,
                [labeled_pdf_1, labeled_pdf_2],
                {},
                entity_types,
                "gpt-4o",
                project_id=PROJECT_ID,
                budget=budget,
            )

        assert len(results) == 2
        assert mock_client.chat.completions.create.call_count == 2

    @pytest.mark.anyio
    async def test_stops_before_next_pdf_when_budget_is_exhausted(
        self, entity_types, labeled_pdf_1, labeled_pdf_2
    ):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="{}"))]
        )

        candidate = PromptCandidate(system_prompt="test", iteration=0)
        conn = AsyncMock()
        budget = CostBudget(max_cost_usd=Decimal("0.01"))
        with patch(
            "app.domains.context_engineering.application.workflows.record_llm_usage",
            new=AsyncMock(return_value=Decimal("0.01")),
        ):
            results = await _evaluate_prompt_on_pdfs(
                conn,
                mock_client,
                candidate,
                [labeled_pdf_1, labeled_pdf_2],
                {},
                entity_types,
                "gpt-4o",
                project_id=PROJECT_ID,
                budget=budget,
            )

        assert len(results) == 1
        assert budget.is_exhausted
        assert mock_client.chat.completions.create.call_count == 1


# ─── prompt_optimization_workflow ────────────────────────────────────────


class TestPromptOptimizationWorkflow:
    @pytest.mark.anyio
    async def test_raises_on_missing_project(self):
        conn = AsyncMock()
        conn.fetchrow.return_value = None
        client = AsyncMock()

        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=TEMPLATE_ID)
        with pytest.raises(ValueError, match="Project not found"):
            await prompt_optimization_workflow(conn, client, cmd)

    @pytest.mark.anyio
    async def test_raises_on_no_entity_types(self):
        conn = AsyncMock()
        conn.fetchrow.side_effect = [
            {"id": PROJECT_ID, "name": "Test", "description": "desc"},
            {"provider": "openai"},
            TEMPLATE_ROW,
        ]
        conn.fetch.return_value = []  # no entity types
        client = AsyncMock()

        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=TEMPLATE_ID)
        with pytest.raises(ValueError, match="No entity types"):
            await prompt_optimization_workflow(conn, client, cmd)

    @pytest.mark.anyio
    async def test_raises_on_missing_template(self):
        conn = AsyncMock()
        conn.fetchrow.side_effect = [
            {"id": PROJECT_ID, "name": "Test", "description": "desc"},
            {"provider": "openai"},
            None,
        ]
        client = AsyncMock()

        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=999)
        with pytest.raises(ValueError, match="Template not found"):
            await prompt_optimization_workflow(conn, client, cmd)

    @pytest.mark.anyio
    async def test_raises_on_no_labeled_pdfs(self, name_entity_type):
        conn = AsyncMock()
        conn.fetchrow.side_effect = [
            {"id": PROJECT_ID, "name": "Test", "description": "desc"},
            {"provider": "openai"},
            TEMPLATE_ROW,
        ]
        # First fetch returns entity types, second returns empty (no pdfs)
        entity_row = {
            "name": name_entity_type.name,
            "user_definition": name_entity_type.user_definition,
            "user_examples": name_entity_type.user_examples,
            "user_format_description": name_entity_type.user_format_description,
            "datatype": name_entity_type.datatype,
            "single_word": name_entity_type.single_word,
            "exact_length": name_entity_type.exact_length,
            "unique": name_entity_type.unique,
            "required": name_entity_type.required,
            "std_definition": name_entity_type.std_definition,
            "std_examples": name_entity_type.std_examples,
            "std_format_description": name_entity_type.std_format_description,
            "std_regex": name_entity_type.std_regex,
            "entity_type_id": name_entity_type.entity_type_id,
        }
        # fetch_entity_types_with_std calls conn.fetch once, fetch_labeled_pdfs calls it again
        conn.fetch.side_effect = [[entity_row], []]
        client = AsyncMock()

        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=TEMPLATE_ID)
        with pytest.raises(ValueError, match="No labeled PDFs"):
            await prompt_optimization_workflow(conn, client, cmd)

    @pytest.mark.anyio
    async def test_full_workflow_convergence(
        self, entity_types, labeled_pdf_1, labeled_pdf_2, labeled_pdf_3
    ):
        """Full workflow that converges after initial variant evaluation."""
        conn = AsyncMock()
        conn.fetchrow.side_effect = [
            {
                "id": PROJECT_ID,
                "name": "Test Project",
                "description": "Test invoices",
            },
            {"provider": "openai"},
            TEMPLATE_ROW,
        ]

        # Build entity type rows
        entity_rows = []
        for et in entity_types:
            entity_rows.append(
                {
                    "name": et.name,
                    "user_definition": et.user_definition,
                    "user_examples": et.user_examples,
                    "user_format_description": et.user_format_description,
                    "datatype": et.datatype,
                    "single_word": et.single_word,
                    "exact_length": et.exact_length,
                    "unique": et.unique,
                    "required": et.required,
                    "std_definition": et.std_definition,
                    "std_examples": et.std_examples,
                    "std_format_description": et.std_format_description,
                    "std_regex": et.std_regex,
                    "entity_type_id": et.entity_type_id,
                }
            )

        # Build PDF and annotation rows
        pdf_rows = [
            {
                "id": labeled_pdf_1.pdf_id,
                "full_text": labeled_pdf_1.full_text,
                "text_by_page": None,
                "bucket_id": BUCKET_ID,
                "filepath": "uploads/doc1.pdf",
            },
            {
                "id": labeled_pdf_2.pdf_id,
                "full_text": labeled_pdf_2.full_text,
                "text_by_page": None,
                "bucket_id": BUCKET_ID,
                "filepath": "uploads/doc2.pdf",
            },
            {
                "id": labeled_pdf_3.pdf_id,
                "full_text": labeled_pdf_3.full_text,
                "text_by_page": None,
                "bucket_id": BUCKET_ID,
                "filepath": "uploads/doc3.pdf",
            },
        ]
        ann_rows = []
        for pdf in [labeled_pdf_1, labeled_pdf_2, labeled_pdf_3]:
            for ann in pdf.annotations:
                ann_rows.append(
                    {
                        "pdf_id": ann.pdf_id,
                        "custom_entity_type": ann.entity_type_name,
                        "entity_type_id": ann.entity_type_id,
                        "contents": ann.labeled_text,
                        "page_index": ann.page_index,
                    }
                )

        conn.fetch.side_effect = [entity_rows, pdf_rows, ann_rows]

        # Mock OpenAI: always return perfect predictions
        perfect_json = json.dumps(
            {
                "full_name": "Alice Johnson",
                "ssn": "111-22-3333",
                "phone_numbers": [],
            }
        )
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=perfect_json))]
        )

        conn.fetchval.return_value = PROMPT_ID

        cmd = OptimizePrompt(
            project_id=PROJECT_ID, template_id=TEMPLATE_ID, max_cost_usd=Decimal("1.00")
        )
        with (
            patch(
                "app.domains.context_engineering.application.workflows.record_llm_usage",
                new=AsyncMock(return_value=Decimal("0.01")),
            ),
        ):
            result = await prompt_optimization_workflow(conn, mock_client, cmd)

        assert "best_prompt_id" in result
        assert "best_f1" in result
        assert "iterations_run" in result
        assert result["cost_usd"] == "0.07"
        assert result["max_cost_usd"] == "1.00"
        assert result["stop_reason"] == "no_errors"
        assert result["best_prompt_id"] == str(PROMPT_ID)
        assert result["llm_call_count"] == 7
        assert conn.fetchval.call_count == 6
        assert conn.executemany.await_count == 2

    @pytest.mark.anyio
    async def test_skips_pdf_with_no_full_text_and_logs_warning(self, name_entity_type, caplog):
        """PDFs with full_text=None are skipped and logged without S3 fallback."""
        import logging

        conn = AsyncMock()
        conn.fetchrow.side_effect = [
            {"id": PROJECT_ID, "name": "Test", "description": "desc"},
            {"provider": "openai"},
            TEMPLATE_ROW,
        ]

        entity_row = {
            "name": name_entity_type.name,
            "user_definition": name_entity_type.user_definition,
            "user_examples": name_entity_type.user_examples,
            "user_format_description": name_entity_type.user_format_description,
            "datatype": name_entity_type.datatype,
            "single_word": name_entity_type.single_word,
            "exact_length": name_entity_type.exact_length,
            "unique": name_entity_type.unique,
            "required": name_entity_type.required,
            "std_definition": name_entity_type.std_definition,
            "std_examples": name_entity_type.std_examples,
            "std_format_description": name_entity_type.std_format_description,
            "std_regex": name_entity_type.std_regex,
            "entity_type_id": name_entity_type.entity_type_id,
        }

        # One PDF with no full_text
        pdf_rows = [
            {
                "id": PDF_ID_1,
                "full_text": None,
                "text_by_page": None,
                "bucket_id": BUCKET_ID,
                "filepath": "uploads/doc1.pdf",
            },
        ]
        ann_rows = [
            {
                "pdf_id": PDF_ID_1,
                "custom_entity_type": "full_name",
                "entity_type_id": name_entity_type.entity_type_id,
                "contents": "John Smith",
                "page_index": 0,
            },
        ]
        conn.fetch.side_effect = [entity_row if False else [entity_row], pdf_rows, ann_rows]

        client = AsyncMock()
        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=TEMPLATE_ID)

        with caplog.at_level(logging.ERROR):
            with pytest.raises(ValueError, match="No labeled PDFs with usable text"):
                await prompt_optimization_workflow(conn, client, cmd)

        assert any("no saved full_text" in r.exc_text for r in caplog.records if r.exc_text)

    @pytest.mark.anyio
    async def test_uses_full_text_from_db_when_present(self, name_entity_type):
        """PDFs that already have full_text do NOT trigger download_pdf_bytes."""
        conn = AsyncMock()
        conn.fetchrow.side_effect = [
            {"id": PROJECT_ID, "name": "Test", "description": "desc"},
            {"provider": "openai"},
            TEMPLATE_ROW,
        ]

        entity_row = {
            "name": name_entity_type.name,
            "user_definition": name_entity_type.user_definition,
            "user_examples": name_entity_type.user_examples,
            "user_format_description": name_entity_type.user_format_description,
            "datatype": name_entity_type.datatype,
            "single_word": name_entity_type.single_word,
            "exact_length": name_entity_type.exact_length,
            "unique": name_entity_type.unique,
            "required": name_entity_type.required,
            "std_definition": name_entity_type.std_definition,
            "std_examples": name_entity_type.std_examples,
            "std_format_description": name_entity_type.std_format_description,
            "std_regex": name_entity_type.std_regex,
            "entity_type_id": name_entity_type.entity_type_id,
        }

        pdf_rows = [
            {
                "id": PDF_ID_1,
                "full_text": "John Smith SSN: 123-45-6789",
                "text_by_page": None,
                "bucket_id": BUCKET_ID,
                "filepath": "uploads/doc1.pdf",
            },
        ]
        ann_rows = [
            {
                "pdf_id": PDF_ID_1,
                "custom_entity_type": "full_name",
                "entity_type_id": name_entity_type.entity_type_id,
                "contents": "John Smith",
                "page_index": 0,
            },
        ]
        conn.fetch.side_effect = [[entity_row], pdf_rows, ann_rows]
        conn.fetchval.return_value = PROMPT_ID

        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({"full_name": "John Smith"})))]
        )

        cmd = OptimizePrompt(
            project_id=PROJECT_ID, template_id=TEMPLATE_ID, max_cost_usd=Decimal("1.00")
        )
        with (
            patch(
                "app.domains.context_engineering.application.workflows.record_llm_usage",
                new=AsyncMock(return_value=Decimal("0.01")),
            ),
        ):
            await prompt_optimization_workflow(conn, mock_client, cmd)

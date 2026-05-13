"""Tests for infrastructure repositories (mocked asyncpg connection)."""

import json
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from app.domains.context_engineering.domain.entities import EntityTypeInfo, LabeledPdf
from app.domains.context_engineering.domain.value_objects import F1Score
from app.domains.context_engineering.infrastructure.repositories import (
    fetch_entity_types_with_std,
    fetch_labeled_pdfs,
    fetch_project,
    insert_evaluation,
    insert_optimized_prompt_examples,
    insert_prompt_attributes,
)
from tests.conftest import PDF_ID_1, PDF_ID_2, PROJECT_ID, PROMPT_ID

BUCKET_ID_1 = uuid4()
ENTITY_TYPE_ID_1 = uuid4()
ENTITY_TYPE_ID_2 = uuid4()


class TestFetchProject:
    @pytest.mark.anyio
    async def test_returns_record(self):
        conn = AsyncMock()
        conn.fetchrow.return_value = {
            "id": PROJECT_ID,
            "name": "Test",
            "description": "Description",
        }
        result = await fetch_project(conn, PROJECT_ID)
        assert result["name"] == "Test"
        conn.fetchrow.assert_awaited_once()

    @pytest.mark.anyio
    async def test_returns_none_when_not_found(self):
        conn = AsyncMock()
        conn.fetchrow.return_value = None
        result = await fetch_project(conn, PROJECT_ID)
        assert result is None


class TestFetchEntityTypesWithStd:
    @pytest.mark.anyio
    async def test_maps_rows_to_entity_types(self):
        conn = AsyncMock()
        conn.fetch.return_value = [
            {
                "name": "full_name",
                "user_definition": "Legal name",
                "user_examples": ["John"],
                "user_format_description": "First Last",
                "datatype": "alpha",
                "single_word": False,
                "exact_length": None,
                "unique": True,
                "required": True,
                "std_definition": "Person name",
                "std_examples": ["Alice"],
                "std_format_description": None,
                "std_regex": None,
            },
        ]
        result = await fetch_entity_types_with_std(conn, PROJECT_ID)
        assert len(result) == 1
        assert isinstance(result[0], EntityTypeInfo)
        assert result[0].name == "full_name"
        assert result[0].user_examples == ["John"]

    @pytest.mark.anyio
    async def test_handles_null_examples(self):
        conn = AsyncMock()
        conn.fetch.return_value = [
            {
                "name": "test",
                "user_definition": None,
                "user_examples": None,
                "user_format_description": None,
                "datatype": None,
                "single_word": False,
                "exact_length": None,
                "unique": True,
                "required": True,
                "std_definition": None,
                "std_examples": None,
                "std_format_description": None,
                "std_regex": None,
            },
        ]
        result = await fetch_entity_types_with_std(conn, PROJECT_ID)
        assert result[0].user_examples == []
        assert result[0].std_examples == []

    @pytest.mark.anyio
    async def test_empty_result(self):
        conn = AsyncMock()
        conn.fetch.return_value = []
        result = await fetch_entity_types_with_std(conn, PROJECT_ID)
        assert result == []


class TestFetchLabeledPdfs:
    @pytest.mark.anyio
    async def test_returns_pdfs_with_annotations(self):
        conn = AsyncMock()
        conn.fetch.side_effect = [
            # pdf_rows
            [
                {
                    "id": PDF_ID_1,
                    "full_text": "Document text",
                    "text_by_page": None,
                    "bucket_id": BUCKET_ID_1,
                    "filepath": "uploads/doc1.pdf",
                },
            ],
            # annotation_rows
            [
                {
                    "pdf_id": PDF_ID_1,
                    "custom_entity_type": "full_name",
                    "entity_type_id": ENTITY_TYPE_ID_1,
                    "contents": "John Smith",
                    "page_index": 0,
                },
                {
                    "pdf_id": PDF_ID_1,
                    "custom_entity_type": "ssn",
                    "entity_type_id": ENTITY_TYPE_ID_2,
                    "contents": "123-45-6789",
                    "page_index": 1,
                },
            ],
        ]
        result = await fetch_labeled_pdfs(conn, PROJECT_ID)
        assert len(result) == 1
        assert isinstance(result[0], LabeledPdf)
        assert len(result[0].annotations) == 2
        assert result[0].full_text == "Document text"
        assert result[0].bucket_id == UUID(str(BUCKET_ID_1))
        assert result[0].filepath == "uploads/doc1.pdf"

    @pytest.mark.anyio
    async def test_excludes_pdfs_without_annotations(self):
        conn = AsyncMock()
        conn.fetch.side_effect = [
            [
                {
                    "id": PDF_ID_1,
                    "full_text": "Has annotations",
                    "text_by_page": None,
                    "bucket_id": BUCKET_ID_1,
                    "filepath": "uploads/doc1.pdf",
                },
                {
                    "id": PDF_ID_2,
                    "full_text": "No annotations",
                    "text_by_page": None,
                    "bucket_id": BUCKET_ID_1,
                    "filepath": "uploads/doc2.pdf",
                },
            ],
            [
                {
                    "pdf_id": PDF_ID_1,
                    "custom_entity_type": "name",
                    "contents": "Test",
                    "page_index": 0,
                },
            ],
        ]
        result = await fetch_labeled_pdfs(conn, PROJECT_ID)
        assert len(result) == 1
        assert result[0].pdf_id == PDF_ID_1

    @pytest.mark.anyio
    async def test_returns_pdf_without_full_text_when_annotated(self):
        """PDFs with no full_text but with annotations are now included (S3 fallback)."""
        conn = AsyncMock()
        conn.fetch.side_effect = [
            [
                {
                    "id": PDF_ID_1,
                    "full_text": None,
                    "text_by_page": None,
                    "bucket_id": BUCKET_ID_1,
                    "filepath": "uploads/doc1.pdf",
                },
            ],
            [
                {
                    "pdf_id": PDF_ID_1,
                    "custom_entity_type": "full_name",
                    "contents": "John Smith",
                    "page_index": 0,
                },
            ],
        ]
        result = await fetch_labeled_pdfs(conn, PROJECT_ID)
        assert len(result) == 1
        assert result[0].full_text is None
        assert result[0].bucket_id == UUID(str(BUCKET_ID_1))
        assert result[0].filepath == "uploads/doc1.pdf"

    @pytest.mark.anyio
    async def test_empty_when_no_pdfs(self):
        conn = AsyncMock()
        conn.fetch.return_value = []
        result = await fetch_labeled_pdfs(conn, PROJECT_ID)
        assert result == []


class TestInsertOptimizedPromptExamples:
    @pytest.mark.anyio
    async def test_inserts_final_example_snapshots(self, labeled_pdf_1):
        from app.domains.context_engineering.domain.services import build_prompt_example_snapshots

        conn = AsyncMock()
        examples = build_prompt_example_snapshots([labeled_pdf_1], max_examples=1)

        await insert_optimized_prompt_examples(conn, PROMPT_ID, examples)

        conn.executemany.assert_awaited_once()
        call_args = conn.executemany.call_args.args
        row = call_args[1][0]
        assert row[0] == PROMPT_ID
        assert row[1] == labeled_pdf_1.pdf_id
        assert row[2] == 0


class TestInsertPromptAttributes:
    @pytest.mark.anyio
    async def test_persists_full_text(self):
        conn = AsyncMock()
        conn.fetchval.return_value = PROMPT_ID
        full_text = "Project: Invoices\nFields: ['full_name']"

        result = await insert_prompt_attributes(
            conn,
            project_id=PROJECT_ID,
            template_id=1,
            full_text=full_text,
            project_description="Invoices",
            entity_types_order=[ENTITY_TYPE_ID_1],
            entity_type_definitions={str(ENTITY_TYPE_ID_1): "Legal name"},
            entity_type_example_values={str(ENTITY_TYPE_ID_1): ["John Smith"]},
            entity_type_example_finds={str(ENTITY_TYPE_ID_1): []},
        )

        assert result == PROMPT_ID
        call_args = conn.fetchval.call_args.args
        assert call_args[8] == full_text


class TestInsertEvaluation:
    @pytest.mark.anyio
    async def test_inserts_scores_as_json(self):
        conn = AsyncMock()
        scores = {
            "name": F1Score(0.9, 0.8, 0.85),
            "ssn": F1Score(1.0, 1.0, 1.0),
        }
        run_id = uuid4()
        await insert_evaluation(conn, run_id, PROMPT_ID, 0.925, scores)
        conn.fetchval.assert_awaited_once()

        # Verify the JSON argument
        call_args = conn.fetchval.call_args[0]
        scores_json = json.loads(call_args[4])
        assert scores_json["name"]["precision"] == 0.9
        assert scores_json["ssn"]["f1"] == 1.0

    @pytest.mark.anyio
    async def test_passes_prompt_id_and_f1(self):
        conn = AsyncMock()
        conn.fetchval.return_value = PROMPT_ID
        scores = {"name": F1Score(0.5, 0.5, 0.5)}
        run_id = uuid4()
        await insert_evaluation(conn, run_id, PROMPT_ID, 0.5, scores)
        call_args = conn.fetchval.call_args[0]
        assert call_args[1] == run_id
        assert call_args[2] == PROMPT_ID
        assert call_args[3] == 0.5

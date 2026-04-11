from unittest.mock import AsyncMock
from uuid import uuid4

from fastapi import HTTPException
import pytest

from app.domains.llm_ner import service
from app.domains.llm_ner.schemas import ExtractEntitiesRequest
from pydantic import ValidationError


class TestBuildPrompt:
    """Unit tests for build_prompt_from_template function."""

    def test_interpolates_all_placeholders(self, sample_entity_types, sample_template):
        """Verify all 7 placeholders are replaced."""
        result = service.build_prompt_from_template(
            template_txt=sample_template["txt"],
            project_description="Invoice processing system",
            entity_types=sample_entity_types,
        )

        assert "<PROJECT_DESCRIPTION>" not in result
        assert "<ENTITY_TYPES>" not in result
        assert "<DEFINITIONS>" not in result
        assert "<EXAMPLE_VALUES>" not in result
        assert "<CONSTRAINTS>" not in result
        assert "<IS_REQUIRED>" not in result
        assert "<IS_UNIQUE>" not in result

    def test_includes_project_description(self, sample_entity_types, sample_template):
        """Verify project description is included in prompt."""
        result = service.build_prompt_from_template(
            template_txt=sample_template["txt"],
            project_description="Invoice processing system",
            entity_types=sample_entity_types,
        )

        assert "Invoice processing system" in result

    def test_includes_entity_names(self, sample_entity_types, sample_template):
        """Verify entity type names are included."""
        result = service.build_prompt_from_template(
            template_txt=sample_template["txt"],
            project_description="Test",
            entity_types=sample_entity_types,
        )

        assert "company_name" in result
        assert "invoice_number" in result

    def test_handles_none_project_description(self, sample_entity_types, sample_template):
        """Verify None project description is handled."""
        result = service.build_prompt_from_template(
            template_txt=sample_template["txt"],
            project_description=None,
            entity_types=sample_entity_types,
        )

        assert "<PROJECT_DESCRIPTION>" not in result


class TestValidateJson:
    """Unit tests for validate_json function."""

    def test_returns_dict_for_valid_json(self):
        """Verify valid JSON returns a dict."""
        result = service.validate_json('{"key": "value", "number": 42}')

        assert result == {"key": "value", "number": 42}

    def test_raises_for_invalid_json(self):
        """Verify invalid JSON raises HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            service.validate_json("not valid json")

        assert exc_info.value.status_code == 422
        assert "not valid JSON" in exc_info.value.detail

    def test_handles_nested_json(self):
        """Verify nested JSON structures are parsed correctly."""
        result = service.validate_json('{"outer": {"inner": [1, 2, 3]}}')

        assert result == {"outer": {"inner": [1, 2, 3]}}


class TestCallLlm:
    """Unit tests for call_llm function."""

    @pytest.mark.anyio
    async def test_routes_to_anthropic(self, mock_clients):
        """Verify anthropic provider routes correctly."""
        result = await service.call_llm(
            mock_clients, "anthropic", "claude-3-opus", "system", "user"
        )

        assert result.text == '{"field1": "value1"}'
        mock_clients["anthropic"].messages.create.assert_called_once()

    @pytest.mark.anyio
    async def test_routes_to_openai(self, mock_clients):
        """Verify openai provider routes correctly."""
        result = await service.call_llm(mock_clients, "openai", "gpt-4o", "system", "user")

        assert result.text == '{"field1": "value1"}'
        mock_clients["openai"].chat.completions.create.assert_called_once()

    @pytest.mark.anyio
    async def test_routes_to_gemini(self, mock_clients):
        """Verify gemini provider routes correctly."""
        result = await service.call_llm(mock_clients, "gemini", "gemini-pro", "system", "user")

        assert result.text == '{"field1": "value1"}'
        mock_clients["gemini"].aio.models.generate_content.assert_called_once()

    @pytest.mark.anyio
    async def test_raises_for_unknown_provider(self, mock_clients):
        """Verify unknown provider raises HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            await service.call_llm(mock_clients, "unknown_provider", "model", "system", "user")

        assert exc_info.value.status_code == 422


class TestExtractEntities:
    """Integration tests for extract_entities function."""

    @pytest.mark.anyio
    async def test_returns_200_with_valid_input(
        self, mock_clients, sample_entity_types, sample_template
    ):
        """Verify successful extraction with valid input."""
        project_id = uuid4()
        prompt_id = uuid4()

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {"id": project_id, "description": "Test project"},
                sample_template,
                # fetch_model_cost: None triggers fallback-to-zero path
                None,
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)
        mock_conn.fetchval = AsyncMock(return_value=prompt_id)
        mock_conn.execute = AsyncMock()

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            document_text="Test document content",
            provider="openai",
            model="gpt-4o",
        )

        result = await service.extract_entities(mock_conn, mock_clients, request)

        assert result["prompt_id"] == str(prompt_id)
        assert "extracted" in result
        assert result["extracted"] == {"field1": "value1"}

    @pytest.mark.anyio
    async def test_returns_404_for_missing_project(self, mock_clients):
        """Verify 404 when project not found."""
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)

        request = ExtractEntitiesRequest(
            project_id=uuid4(),
            template_id=1,
            document_text="Test",
            provider="openai",
            model="gpt-4o",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 404
        assert "Project not found" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_returns_404_for_missing_template(self, mock_clients, sample_entity_types):
        """Verify 404 when template not found."""
        project_id = uuid4()

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {"id": project_id, "description": "Test"},
                None,  # template not found
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=999,
            document_text="Test",
            provider="openai",
            model="gpt-4o",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 404
        assert "Template not found" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_returns_400_for_no_entity_types(self, mock_clients):
        """Verify 400 when no entity types defined."""
        project_id = uuid4()

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value={"id": project_id, "description": "Test"})
        mock_conn.fetch = AsyncMock(return_value=[])  # empty entity types

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            document_text="Test",
            provider="openai",
            model="gpt-4o",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 400
        assert "No entity types defined" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_extract_entities_with_pdf_id_success(
        self, mock_clients, sample_entity_types, sample_template
    ):
        """Provide pdf_id without document_text; fetched text is passed to LLM."""
        project_id = uuid4()
        pdf_id = uuid4()
        prompt_id = uuid4()
        extracted_text = "Invoice text from PDF"

        mock_conn = AsyncMock()
        # fetchrow: project, then template; fetchrow for fetch_pdf_text
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {"id": project_id, "description": "Test project"},
                sample_template,
                {"full_text": extracted_text},  # fetch_pdf_text
                # fetch_model_cost: None triggers fallback-to-zero path
                None,
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)
        mock_conn.fetchval = AsyncMock(return_value=prompt_id)
        mock_conn.execute = AsyncMock()

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            pdf_id=pdf_id,
            provider="openai",
            model="gpt-4o",
        )

        result = await service.extract_entities(mock_conn, mock_clients, request)

        assert result["prompt_id"] == str(prompt_id)
        assert result["extracted"] == {"field1": "value1"}
        # Verify the openai client was called (text was passed to LLM)
        mock_clients["openai"].chat.completions.create.assert_called_once()

    @pytest.mark.anyio
    async def test_extract_entities_pdf_not_found(
        self, mock_clients, sample_entity_types, sample_template
    ):
        """Returns 404 when fetch_pdf_text returns None (PDF not in DB)."""
        project_id = uuid4()
        pdf_id = uuid4()

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {"id": project_id, "description": "Test project"},
                sample_template,
                None,  # fetch_pdf_text returns None
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            pdf_id=pdf_id,
            provider="openai",
            model="gpt-4o",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 404
        assert "PDF not found" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_extract_entities_pdf_empty_text(
        self, mock_clients, sample_entity_types, sample_template
    ):
        """Returns 422 when fetched PDF text is blank/whitespace."""
        project_id = uuid4()
        pdf_id = uuid4()

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {"id": project_id, "description": "Test project"},
                sample_template,
                {"full_text": "   "},  # whitespace only
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            pdf_id=pdf_id,
            provider="openai",
            model="gpt-4o",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 422
        assert "no text content" in exc_info.value.detail


class TestExtractEntitiesRequestSchema:
    """Test the Pydantic schema validation."""

    def test_valid_request(self):
        """Verify valid request passes validation."""
        request = ExtractEntitiesRequest(
            project_id=uuid4(),
            template_id=1,
            document_text="Test document",
            provider="openai",
            model="gpt-4o",
        )

        assert request.provider == "openai"

    def test_invalid_provider_rejected(self):
        """Verify invalid provider is rejected by Pydantic."""
        with pytest.raises(ValueError):
            ExtractEntitiesRequest(
                project_id=uuid4(),
                template_id=1,
                document_text="Test",
                provider="invalid_provider",
                model="model",
            )

    def test_requires_text_or_pdf_id(self):
        """Verify ValidationError when neither document_text nor pdf_id is provided."""
        with pytest.raises(ValidationError) as exc_info:
            ExtractEntitiesRequest(
                project_id=uuid4(),
                template_id=1,
                provider="openai",
                model="gpt-4o",
                # no document_text, no pdf_id
            )

        errors = exc_info.value.errors()
        assert any("Either document_text or pdf_id" in str(e) for e in errors)

    def test_valid_with_pdf_id_only(self):
        """Verify request with pdf_id and no document_text passes validation."""
        request = ExtractEntitiesRequest(
            project_id=uuid4(),
            template_id=1,
            pdf_id=uuid4(),
            provider="openai",
            model="gpt-4o",
        )

        assert request.pdf_id is not None
        assert request.document_text == ""

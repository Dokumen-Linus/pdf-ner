from unittest.mock import AsyncMock
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
import pytest

from app.domains.llm_ner import service
from app.domains.llm_ner.schemas import ExtractEntitiesRequest


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
        owner_id = uuid4()
        prompt_id = uuid4()

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {
                    "id": project_id,
                    "description": "Test project",
                    "owner_id": owner_id,
                    "organization_id": None,
                },
                {
                    "id": "gpt-4o",
                    "provider": "openai",
                    "usd_per_1m_input": 2.5,
                    "usd_per_1m_output": 10,
                },
                sample_template,
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)
        mock_conn.fetchval = AsyncMock(return_value=prompt_id)
        mock_conn.execute = AsyncMock()

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            document_text="Test document content",
            model="gpt-4o",
        )

        result = await service.extract_entities(mock_conn, mock_clients, request)

        assert result["prompt_id"] == str(prompt_id)
        assert "extracted" in result
        assert result["extracted"] == {"field1": "value1"}
        insert_sql = mock_conn.execute.await_args.args[0]
        assert "provider" not in insert_sql
        assert "model_id" in insert_sql

    @pytest.mark.anyio
    async def test_returns_404_for_missing_project(self, mock_clients):
        """Verify 404 when project not found."""
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)

        request = ExtractEntitiesRequest(
            project_id=uuid4(),
            template_id=1,
            document_text="Test",
            model="gpt-4o",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 404
        assert "Project not found" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_returns_422_for_missing_model(self, mock_clients):
        """Verify unavailable model fails before LLM call."""
        project_id = uuid4()
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {
                    "id": project_id,
                    "description": "Test project",
                    "owner_id": uuid4(),
                    "organization_id": None,
                },
                None,
            ]
        )

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            document_text="Test",
            model="missing-model",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 422
        assert "Model is not available" in exc_info.value.detail
        mock_clients["openai"].chat.completions.create.assert_not_called()

    @pytest.mark.anyio
    async def test_returns_422_for_unsupported_model_provider(self, mock_clients):
        """Verify unsupported provider in public.models fails before LLM call."""
        project_id = uuid4()
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {
                    "id": project_id,
                    "description": "Test project",
                    "owner_id": uuid4(),
                    "organization_id": None,
                },
                {
                    "id": "custom-model",
                    "provider": "custom",
                    "usd_per_1m_input": 1,
                    "usd_per_1m_output": 1,
                },
            ]
        )

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            document_text="Test",
            model="custom-model",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.extract_entities(mock_conn, mock_clients, request)

        assert exc_info.value.status_code == 422
        assert "Unsupported model provider" in exc_info.value.detail
        mock_clients["openai"].chat.completions.create.assert_not_called()

    @pytest.mark.anyio
    async def test_returns_404_for_missing_template(self, mock_clients, sample_entity_types):
        """Verify 404 when template not found."""
        project_id = uuid4()

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {
                    "id": project_id,
                    "description": "Test",
                    "owner_id": uuid4(),
                    "organization_id": None,
                },
                {
                    "id": "gpt-4o",
                    "provider": "openai",
                    "usd_per_1m_input": 2.5,
                    "usd_per_1m_output": 10,
                },
                None,  # template not found
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=999,
            document_text="Test",
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
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {
                    "id": project_id,
                    "description": "Test",
                    "owner_id": uuid4(),
                    "organization_id": None,
                },
                {
                    "id": "gpt-4o",
                    "provider": "openai",
                    "usd_per_1m_input": 2.5,
                    "usd_per_1m_output": 10,
                },
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=[])  # empty entity types

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            document_text="Test",
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
                {
                    "id": project_id,
                    "description": "Test project",
                    "owner_id": uuid4(),
                    "organization_id": None,
                },
                {
                    "id": "gpt-4o",
                    "provider": "openai",
                    "usd_per_1m_input": 2.5,
                    "usd_per_1m_output": 10,
                },
                sample_template,
                {"full_text": extracted_text},  # fetch_pdf_text
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)
        mock_conn.fetchval = AsyncMock(return_value=prompt_id)
        mock_conn.execute = AsyncMock()

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            pdf_id=pdf_id,
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
                {
                    "id": project_id,
                    "description": "Test project",
                    "owner_id": uuid4(),
                    "organization_id": None,
                },
                {
                    "id": "gpt-4o",
                    "provider": "openai",
                    "usd_per_1m_input": 2.5,
                    "usd_per_1m_output": 10,
                },
                sample_template,
                None,  # fetch_pdf_text returns None
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            pdf_id=pdf_id,
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
                {
                    "id": project_id,
                    "description": "Test project",
                    "owner_id": uuid4(),
                    "organization_id": None,
                },
                {
                    "id": "gpt-4o",
                    "provider": "openai",
                    "usd_per_1m_input": 2.5,
                    "usd_per_1m_output": 10,
                },
                sample_template,
                {"full_text": "   "},  # whitespace only
            ]
        )
        mock_conn.fetch = AsyncMock(return_value=sample_entity_types)

        request = ExtractEntitiesRequest(
            project_id=project_id,
            template_id=1,
            pdf_id=pdf_id,
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
            model="gpt-4o",
        )

        assert request.model == "gpt-4o"

    def test_requires_text_or_pdf_id(self):
        """Verify ValidationError when neither document_text nor pdf_id is provided."""
        with pytest.raises(ValidationError) as exc_info:
            ExtractEntitiesRequest(
                project_id=uuid4(),
                template_id=1,
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
            model="gpt-4o",
        )

        assert request.pdf_id is not None
        assert request.document_text == ""


class TestOptimizePromptAuthorization:
    """Tests for authorization on prompt optimization endpoints."""

    @pytest.mark.anyio
    async def test_optimize_prompt_returns_404_for_nonexistent_project(
        self, async_client, mock_conn
    ):
        """Verify 404 when project_id doesn't exist in database."""
        mock_conn.fetchrow = AsyncMock(return_value=None)

        response = await async_client.post(
            "/api/v1/llm-ner/optimize-prompt",
            json={
                "project_id": str(uuid4()),
                "template_id": 1,
                "max_cost_usd": "1.00",
                "model": "gpt-4o",
            },
        )

        assert response.status_code == 404
        assert "Project not found" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_optimize_prompt_returns_404_for_missing_template(self, async_client, mock_conn):
        project_id = uuid4()
        mock_conn.fetchrow = AsyncMock(side_effect=[{"id": project_id}, None])

        response = await async_client.post(
            "/api/v1/llm-ner/optimize-prompt",
            json={
                "project_id": str(project_id),
                "template_id": 999,
                "max_cost_usd": "1.00",
                "model": "gpt-4o",
            },
        )

        assert response.status_code == 404
        assert "Template not found" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_optimize_prompt_stores_task_project_mapping(
        self, async_client, mock_conn, mock_redis, monkeypatch
    ):
        """Verify task->project mapping is stored in Redis on successful dispatch."""
        from app.domains.llm_ner import events

        project_id = uuid4()
        mock_task_id = "mock-task-id-123"
        dispatch_calls = []

        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {"id": project_id, "description": "Test"},
                {"id": 1, "txt": "template"},
            ]
        )

        def fake_dispatch(**kw):
            dispatch_calls.append(kw)
            return mock_task_id

        monkeypatch.setattr(events, "dispatch_optimize_prompt", fake_dispatch)

        response = await async_client.post(
            "/api/v1/llm-ner/optimize-prompt",
            json={
                "project_id": str(project_id),
                "template_id": 1,
                "max_cost_usd": "1.00",
                "model": "gpt-4o",
            },
        )

        assert response.status_code == 200
        assert response.json()["task_id"] == mock_task_id
        assert dispatch_calls[0]["template_id"] == 1

        # Verify redis.set was called with the task->project mapping
        mock_redis.set.assert_called_once()
        call_args = mock_redis.set.call_args
        assert f"task:project:{mock_task_id}" == call_args[0][0]
        assert str(project_id) == call_args[0][1]

    @pytest.mark.anyio
    async def test_status_returns_project_id_from_redis(
        self, async_client, mock_redis, monkeypatch
    ):
        """Verify status endpoint returns project_id looked up from Redis."""
        from app.domains.llm_ner import events

        project_id = str(uuid4())
        task_id = "test-task-123"

        mock_redis.get = AsyncMock(return_value=project_id)
        monkeypatch.setattr(
            events,
            "get_task_status",
            lambda tid: {"task_id": tid, "status": "PENDING"},
        )

        response = await async_client.get(f"/api/v1/llm-ner/optimize-prompt/{task_id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == project_id
        mock_redis.get.assert_called_with(f"task:project:{task_id}")

    @pytest.mark.anyio
    async def test_status_returns_null_project_id_for_unknown_task(
        self, async_client, mock_redis, monkeypatch
    ):
        """Verify status returns null project_id when task not in Redis."""
        from app.domains.llm_ner import events

        mock_redis.get = AsyncMock(return_value=None)
        monkeypatch.setattr(
            events,
            "get_task_status",
            lambda tid: {"task_id": tid, "status": "PENDING"},
        )

        response = await async_client.get("/api/v1/llm-ner/optimize-prompt/unknown-task/status")

        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] is None

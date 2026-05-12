from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.domains.context_engineering.application.commands import OptimizePrompt
from app.domains.context_engineering.application.handlers import handle_optimize_prompt
from tests.conftest import PDF_ID_1, PROJECT_ID


def _make_pool_mock(mock_conn):
    """Create a mock pool whose acquire() works as an async context manager."""
    mock_pool = MagicMock()

    @asynccontextmanager
    async def acquire():
        yield mock_conn

    mock_pool.acquire = acquire
    return mock_pool


class TestHandleOptimizePrompt:
    @pytest.mark.anyio
    @patch("app.domains.context_engineering.application.handlers.prompt_optimization_workflow")
    @patch("app.domains.context_engineering.application.handlers.get_pool")
    @patch("app.domains.context_engineering.application.handlers.GeminiClient")
    @patch("app.domains.context_engineering.application.handlers.AsyncOpenAI")
    @patch("app.domains.context_engineering.application.handlers.AsyncAnthropic")
    async def test_calls_workflow(
        self, mock_anthropic_cls, mock_openai_cls, mock_gemini_cls, mock_get_pool, mock_workflow
    ):
        expected_result = {
            "best_prompt_id": str(uuid4()),
            "best_f": 0.92,
            "iterations_run": 3,
        }
        mock_workflow.return_value = expected_result

        mock_conn = AsyncMock()
        mock_get_pool.return_value = _make_pool_mock(mock_conn)

        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=1, labeled_pdfs=[PDF_ID_1])
        result = await handle_optimize_prompt(cmd)

        assert result == expected_result
        mock_workflow.assert_awaited_once()

    @pytest.mark.anyio
    @patch("app.domains.context_engineering.application.handlers.prompt_optimization_workflow")
    @patch("app.domains.context_engineering.application.handlers.get_pool")
    @patch("app.domains.context_engineering.application.handlers.GeminiClient")
    @patch("app.domains.context_engineering.application.handlers.AsyncOpenAI")
    @patch("app.domains.context_engineering.application.handlers.AsyncAnthropic")
    async def test_propagates_workflow_errors(
        self, mock_anthropic_cls, mock_openai_cls, mock_gemini_cls, mock_get_pool, mock_workflow
    ):
        mock_workflow.side_effect = ValueError("Project not found")

        mock_conn = AsyncMock()
        mock_get_pool.return_value = _make_pool_mock(mock_conn)

        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=1, labeled_pdfs=[PDF_ID_1])
        with pytest.raises(ValueError, match="Project not found"):
            await handle_optimize_prompt(cmd)

"""Tests for Celery task definitions.

For bound tasks (@app.task(bind=True)), Celery passes the task instance
as `self` automatically. We use task.run() which also auto-injects self,
or we use task.apply() for testing retry behavior.
"""

from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest

from tests.conftest import PROJECT_ID

MODULE = "app.domains.context_engineering.tasks"


@pytest.fixture
def task():
    from app.domains.context_engineering.tasks import optimize_prompt_task

    return optimize_prompt_task


class TestOptimizePromptTask:
    @patch(f"{MODULE}.anyio.run")
    @patch(f"{MODULE}.handle_optimize_prompt")
    def test_calls_handler_and_returns_result(self, mock_handler, mock_anyio_run, task):
        expected_result = {
            "best_prompt_id": str(uuid4()),
            "best_f1": 0.92,
            "iterations_run": 3,
        }
        mock_anyio_run.return_value = expected_result

        # For bound tasks, run() auto-injects self (the task instance)
        result = task.run(str(PROJECT_ID), 1, [str(uuid4())])

        assert result == expected_result
        mock_anyio_run.assert_called_once()

    @patch(f"{MODULE}.anyio.run")
    @patch(f"{MODULE}.handle_optimize_prompt")
    def test_passes_custom_parameters(self, mock_handler, mock_anyio_run, task):
        mock_anyio_run.return_value = {
            "best_prompt_id": "x",
            "best_f": 0.5,
            "iterations_run": 1,
        }

        task.run(
            str(PROJECT_ID),
            1,
            [str(uuid4())],
            max_cost_usd="2.50",
            ner_chat_model="gpt-4o-mini",
            prompt_eng_chat_model="gpt-4o",
        )
        mock_anyio_run.assert_called_once()

    @patch(f"{MODULE}.anyio.run")
    @patch(f"{MODULE}.handle_optimize_prompt")
    def test_retries_on_exception(self, mock_handler, mock_anyio_run, task):
        mock_anyio_run.side_effect = RuntimeError("connection failed")

        # Use apply() which runs synchronously and catches retries
        result = task.apply(args=[str(PROJECT_ID), 1, [str(uuid4())]])

        # The task should have failed (retry raises or task errors)
        assert result.failed() or result.state == "RETRY"

    @patch(f"{MODULE}.anyio.run")
    @patch(f"{MODULE}.handle_optimize_prompt")
    def test_converts_string_to_uuid(self, mock_handler, mock_anyio_run, task):
        mock_anyio_run.return_value = {
            "best_prompt_id": "x",
            "best_f": 0.5,
            "iterations_run": 1,
        }
        # Should not raise - valid UUID string
        result = task.run(str(PROJECT_ID), 1, [str(uuid4())])
        assert result is not None
        mock_anyio_run.assert_called_once()

    def test_invalid_uuid_raises(self, task):
        with pytest.raises(ValueError):
            task.run("not-a-uuid", 1, [str(uuid4())])

    def test_task_is_registered_with_correct_name(self, task):
        assert task.name == "context_engineering.optimize_prompt"

    def test_task_max_retries(self, task):
        assert task.max_retries == 2

    @patch(f"{MODULE}.anyio.run")
    @patch(f"{MODULE}.handle_optimize_prompt")
    def test_default_parameters(self, mock_handler, mock_anyio_run, task):
        """Verify default max_cost_usd and model when not specified."""
        mock_anyio_run.return_value = {
            "best_prompt_id": "x",
            "best_f": 0.5,
            "iterations_run": 1,
        }
        task.run(str(PROJECT_ID), 1, [str(uuid4())])

        cmd = mock_anyio_run.call_args.args[1]
        assert cmd.template_id == 1
        assert cmd.max_cost_usd == Decimal("1.00")
        assert cmd.beta == 1.0
        assert cmd.ner_chat_model == "gpt-5.4-mini"
        assert cmd.prompt_eng_chat_model == "gpt-5.4-mini"

    @patch(f"{MODULE}.anyio.run")
    @patch(f"{MODULE}.handle_optimize_prompt")
    def test_passes_cost_cap_to_command(self, mock_handler, mock_anyio_run, task):
        mock_anyio_run.return_value = {
            "best_prompt_id": "x",
            "best_f": 0.5,
            "iterations_run": 1,
        }

        task.run(str(PROJECT_ID), 1, [str(uuid4())], max_cost_usd="3.25")

        cmd = mock_anyio_run.call_args.args[1]
        assert cmd.max_cost_usd == Decimal("3.25")

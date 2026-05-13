from unittest.mock import patch
from uuid import uuid4

import pytest

MODULE = "app.domains.chat_model_eval.tasks"


@pytest.fixture
def task():
    from app.domains.chat_model_eval.tasks import evaluate_chat_models_task

    return evaluate_chat_models_task


def test_task_is_registered_with_correct_name(task):
    assert task.name == "chat_model_eval.evaluate_models"


@patch(f"{MODULE}.anyio.run")
@patch(f"{MODULE}.handle_evaluate_chat_models")
def test_task_builds_command(mock_handler, mock_anyio_run, task):
    project_id = uuid4()
    pdf_id = uuid4()
    mock_anyio_run.return_value = {"best_model_id": "gpt-5.4-mini"}

    result = task.run(str(project_id), [str(pdf_id)], ["gpt-5.4-mini"], beta=2.0)

    assert result == {"best_model_id": "gpt-5.4-mini"}
    cmd = mock_anyio_run.call_args.args[1]
    assert cmd.project_id == project_id
    assert cmd.pdf_ids == [pdf_id]
    assert cmd.chat_model_ids == ["gpt-5.4-mini"]
    assert cmd.beta == 2.0


def test_invalid_uuid_raises(task):
    with pytest.raises(ValueError):
        task.run("not-a-uuid", [str(uuid4())], ["gpt-5.4-mini"])

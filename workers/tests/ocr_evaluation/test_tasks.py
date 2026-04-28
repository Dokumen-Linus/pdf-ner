from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest

MODULE = "app.domains.ocr_evaluation.tasks"


def test_task_is_registered():
    from app.domains.ocr_evaluation.tasks import evaluate_project_ocr_task

    assert evaluate_project_ocr_task.name == "ocr_evaluation.evaluate_project"
    assert evaluate_project_ocr_task.max_retries == 2


@patch(f"{MODULE}.anyio.run")
def test_task_requires_and_passes_judge_model(mock_run):
    from app.domains.ocr_evaluation.tasks import evaluate_project_ocr_task

    project_id = uuid4()
    mock_run.return_value = {"ok": True}

    result = evaluate_project_ocr_task.run(
        str(project_id),
        "gemini-2.0-flash",
        max_pdfs=2,
        max_pages_per_pdf=1,
        max_cost_usd="1.25",
    )

    assert result == {"ok": True}
    cmd = mock_run.call_args.args[1]
    assert cmd.project_id == project_id
    assert cmd.judge_model == "gemini-2.0-flash"
    assert cmd.max_pdfs == 2
    assert cmd.max_pages_per_pdf == 1
    assert cmd.max_cost_usd == Decimal("1.25")


def test_task_rejects_missing_judge_model():
    from app.domains.ocr_evaluation.tasks import evaluate_project_ocr_task

    with pytest.raises(ValueError, match="judge_model is required"):
        evaluate_project_ocr_task.run(str(uuid4()), "")


def test_task_rejects_invalid_uuid():
    from app.domains.ocr_evaluation.tasks import evaluate_project_ocr_task

    with pytest.raises(ValueError):
        evaluate_project_ocr_task.run("not-a-uuid", "gemini-2.0-flash")

from unittest.mock import patch
from uuid import uuid4

import pytest

MODULE = "app.domains.text_extract.tasks"


def test_text_extract_task_is_registered():
    from app.domains.text_extract.tasks import extract_missing_pdf_texts_task

    assert extract_missing_pdf_texts_task.name == "text_extract.extract_missing_pdf_texts"
    assert extract_missing_pdf_texts_task.max_retries == 2


@patch(f"{MODULE}.anyio.run")
def test_text_extract_task_parses_ids_and_method(mock_run):
    from app.domains.text_extract.tasks import extract_missing_pdf_texts_task

    mock_run.return_value = {"ok": True}
    project_id = uuid4()
    pdf_id = uuid4()

    result = extract_missing_pdf_texts_task.run(str(project_id), [str(pdf_id)], "pdfium")

    assert result == {"ok": True}
    cmd = mock_run.call_args.args[1]
    assert cmd.project_id == project_id
    assert cmd.pdf_ids == [pdf_id]
    assert cmd.extract_method == "pdfium"


def test_text_extract_task_rejects_invalid_uuid():
    from app.domains.text_extract.tasks import extract_missing_pdf_texts_task

    with pytest.raises(ValueError):
        extract_missing_pdf_texts_task.run(str(uuid4()), ["not-a-uuid"], "pdfium")


def test_text_extract_task_rejects_invalid_method():
    from app.domains.text_extract.tasks import extract_missing_pdf_texts_task

    with pytest.raises(ValueError, match="Unsupported extraction method"):
        extract_missing_pdf_texts_task.run(str(uuid4()), [str(uuid4())], "metadata")

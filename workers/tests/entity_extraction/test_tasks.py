from unittest.mock import patch
from uuid import uuid4

import pytest


def test_entity_extraction_task_is_registered():
    from app.domains.entity_extraction.tasks import process_document_source_task

    assert process_document_source_task.name == "entity_extraction.process_document_source"
    assert process_document_source_task.max_retries == 2


@patch("app.domains.entity_extraction.tasks.anyio.run")
def test_entity_extraction_task_parses_ids(mock_run):
    from app.domains.entity_extraction.tasks import process_document_source_task

    mock_run.return_value = {"ok": True}
    document_source_id = uuid4()
    optimized_prompt_id = uuid4()

    result = process_document_source_task.run(str(document_source_id), str(optimized_prompt_id))

    assert result == {"ok": True}
    cmd = mock_run.call_args.args[1]
    assert cmd.document_source_id == document_source_id
    assert cmd.optimized_prompt_id == optimized_prompt_id


def test_entity_extraction_task_rejects_invalid_uuid():
    from app.domains.entity_extraction.tasks import process_document_source_task

    with pytest.raises(ValueError):
        process_document_source_task.run("not-a-uuid", str(uuid4()))

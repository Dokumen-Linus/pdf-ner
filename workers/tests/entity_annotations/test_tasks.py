from unittest.mock import patch
from uuid import uuid4

import pytest


def test_entity_annotations_task_is_registered():
    from app.domains.entity_annotations.tasks import create_predicted_entity_annotations_task

    assert create_predicted_entity_annotations_task.name == (
        "entity_annotations.create_predicted_entity_annotations"
    )
    assert create_predicted_entity_annotations_task.max_retries == 2


@patch("app.domains.entity_annotations.tasks.anyio.run")
def test_entity_annotations_task_parses_ids(mock_run):
    from app.domains.entity_annotations.tasks import create_predicted_entity_annotations_task

    mock_run.return_value = {"ok": True}
    ner_run_id = uuid4()

    result = create_predicted_entity_annotations_task.run(str(ner_run_id), overwrite=True)

    assert result == {"ok": True}
    cmd = mock_run.call_args.args[1]
    assert cmd.ner_run_id == ner_run_id
    assert cmd.overwrite is True


def test_entity_annotations_task_rejects_invalid_uuid():
    from app.domains.entity_annotations.tasks import create_predicted_entity_annotations_task

    with pytest.raises(ValueError):
        create_predicted_entity_annotations_task.run("not-a-uuid")

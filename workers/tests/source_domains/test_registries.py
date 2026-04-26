import pytest

from app.domains.source_listeners.domain.services import ListenerRegistry
from app.domains.source_watchers.domain.services import WatcherRegistry, extraction_task_args


def test_watcher_registry_requires_registered_provider():
    registry = WatcherRegistry()

    with pytest.raises(LookupError, match="No source watcher"):
        registry.resolve("gmail")


def test_listener_registry_requires_registered_provider():
    registry = ListenerRegistry()

    with pytest.raises(LookupError, match="No source listener"):
        registry.resolve("drive")


def test_extraction_task_args_are_serializable():
    import uuid

    document_source_id = uuid.uuid4()
    optimized_prompt_id = uuid.uuid4()

    assert extraction_task_args(document_source_id, optimized_prompt_id) == (
        str(document_source_id),
        str(optimized_prompt_id),
    )


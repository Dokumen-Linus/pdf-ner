from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.domains.source_listeners.application import handlers as listener_handlers
from app.domains.source_listeners.application.commands import CreateListener
from app.domains.source_watchers.application import handlers as watcher_handlers
from app.domains.source_watchers.application.commands import PollSourceConnection
from app.shared.application.commands import RecordMonitoringEvent
from app.shared.application.handlers import handle_record_monitoring_event
from app.shared.domain.services import build_monitoring_event, sanitize_record
from app.shared.infrastructure import event_publisher
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync
from app.shared.infrastructure.repositories import AsyncpgMonitoringEventRepository


def test_sanitize_record_omits_secrets_and_binary_payloads():
    visible_id = uuid4()

    sanitized = sanitize_record(
        {
            "provider": "google_drive",
            "authorization": "Bearer secret",
            "document": b"%PDF",
            "nested": {"api_key": "secret", "source_id": visible_id},
        }
    )

    assert sanitized == {
        "provider": "google_drive",
        "document": "[BinaryPayloadOmitted]",
        "nested": {"source_id": str(visible_id)},
    }


def test_build_monitoring_event_sets_error_severity_and_sanitizes_raw_payload():
    event = build_monitoring_event(
        event_name="workers.task.failed",
        event_kind="task_lifecycle",
        operation_type="mutation",
        source="text_extract.extract_missing_pdf_texts",
        status="failed",
        metadata={"pdf_count": 3},
        raw_error_payload={"body": b"%PDF", "cookie": "session"},
    )

    assert event.severity == "error"
    assert event.metadata == {"pdf_count": 3}
    assert event.raw_error_payload == {"body": "[BinaryPayloadOmitted]"}


@pytest.mark.anyio
async def test_record_monitoring_handler_persists_domain_event():
    repo = AsyncMock()
    project_id = uuid4()

    await handle_record_monitoring_event(
        RecordMonitoringEvent(
            event_name="workers.task.succeeded",
            event_kind="task_lifecycle",
            operation_type="mutation",
            source="ocr_evaluation.evaluate_ocr_models",
            status="succeeded",
            project_id=project_id,
            task_id="task-1",
            metadata={"recommendation": "olm-ocr2"},
        ),
        repo,
    )

    event = repo.add.await_args.args[0]
    assert event.event_name == "workers.task.succeeded"
    assert event.status == "succeeded"
    assert event.severity == "info"
    assert event.project_id == project_id
    assert event.task_id == "task-1"
    assert event.metadata == {"recommendation": "olm-ocr2"}


@pytest.mark.anyio
async def test_asyncpg_monitoring_repository_inserts_workers_event():
    conn = AsyncMock()
    repository = AsyncpgMonitoringEventRepository(conn)
    event = build_monitoring_event(
        event_name="workers.source_watchers.poll.succeeded",
        event_kind="source_integration",
        operation_type="mutation",
        source="source_watchers",
        status="succeeded",
        resource_type="source_connection",
        resource_id="connection-1",
        metadata={"provider": "google_drive"},
    )

    await repository.add(event)

    query, *args = conn.execute.await_args.args
    assert "INSERT INTO workers.monitoring_events" in query
    assert args[0] == event.event_id
    assert args[2] == "workers.source_watchers.poll.succeeded"
    assert args[20] == '{"provider": "google_drive"}'


def test_task_lifecycle_publisher_captures_task_context(monkeypatch):
    published = []

    class Request:
        id = "celery-task-id"
        retries = 1

    class Task:
        request = Request()
        max_retries = 2

    monkeypatch.setattr(
        "app.shared.infrastructure.event_publisher.publish_monitoring_event_sync",
        lambda **kwargs: published.append(kwargs),
    )

    publish_task_lifecycle_event_sync(
        status="retrying",
        task=Task(),
        task_name="text_extract.extract_missing_pdf_texts",
        metadata={"pdf_count": 2},
        error=RuntimeError("temporary provider failure"),
    )

    event = published[0]
    assert event["event_name"] == "workers.task.retrying"
    assert event["event_kind"] == "task_lifecycle"
    assert event["source"] == "text_extract.extract_missing_pdf_texts"
    assert event["task_id"] == "celery-task-id"
    assert event["metadata"] == {
        "pdf_count": 2,
        "retry_count": 1,
        "max_retries": 2,
    }
    assert event["raw_error_payload"] == {"pdf_count": 2}
    assert event["error_type"] == "RuntimeError"


@pytest.mark.anyio
async def test_workers_monitoring_persistence_failure_does_not_raise(monkeypatch):
    monkeypatch.setattr(
        event_publisher,
        "get_pool",
        AsyncMock(side_effect=RuntimeError("monitoring db down")),
    )

    await event_publisher.publish_monitoring_event(
        event_name="workers.task.succeeded",
        event_kind="task_lifecycle",
        operation_type="mutation",
        source="text_extract.extract_missing_pdf_texts",
        status="succeeded",
    )


@pytest.mark.anyio
async def test_workers_monitoring_retention_is_throttled(monkeypatch):
    conn = AsyncMock()
    pool = _FakePool(conn)

    monkeypatch.setattr(event_publisher, "get_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(event_publisher, "_last_retention_sweep_at", 100.0)
    monkeypatch.setattr(event_publisher.time, "monotonic", lambda: 3701.0)

    await event_publisher.publish_monitoring_event(
        event_name="workers.task.succeeded",
        event_kind="task_lifecycle",
        operation_type="mutation",
        source="text_extract.extract_missing_pdf_texts",
        status="succeeded",
    )
    await event_publisher.publish_monitoring_event(
        event_name="workers.task.succeeded",
        event_kind="task_lifecycle",
        operation_type="mutation",
        source="text_extract.extract_missing_pdf_texts",
        status="succeeded",
    )

    cleanup_calls = [
        call
        for call in conn.execute.await_args_list
        if "DELETE FROM workers.monitoring_events" in call.args[0]
    ]
    insert_calls = [
        call
        for call in conn.execute.await_args_list
        if "INSERT INTO workers.monitoring_events" in call.args[0]
    ]
    assert len(cleanup_calls) == 1
    assert cleanup_calls[0].args[1] == "180 days"
    assert len(insert_calls) == 2


@pytest.mark.anyio
async def test_source_watcher_provider_failure_records_failed_event(monkeypatch):
    connection_id = uuid4()
    project_id = uuid4()
    run_id = uuid4()
    published = AsyncMock()
    fail_watch_run = AsyncMock()

    monkeypatch.setattr(watcher_handlers, "RedisLock", lambda *args, **kwargs: _FakeLock(True))
    monkeypatch.setattr(
        watcher_handlers, "get_pool", AsyncMock(return_value=_FakePool(AsyncMock()))
    )
    monkeypatch.setattr(
        watcher_handlers.repo,
        "fetch_connection",
        AsyncMock(
            return_value={
                "project_id": project_id,
                "provider": "google_drive",
                "source_connection_id": connection_id,
                "source_id": uuid4(),
                "ner_workflow_id": uuid4(),
                "poll_interval_seconds": 300,
            }
        ),
    )
    monkeypatch.setattr(watcher_handlers.repo, "fetch_cursor", AsyncMock(return_value=None))
    monkeypatch.setattr(watcher_handlers.repo, "insert_watch_run", AsyncMock(return_value=run_id))
    monkeypatch.setattr(watcher_handlers.repo, "fail_watch_run", fail_watch_run)
    monkeypatch.setattr(
        watcher_handlers.provider_registry,
        "build_registry",
        lambda conn: _Registry(_Provider(discover_error=RuntimeError("provider unavailable"))),
    )
    monkeypatch.setattr(watcher_handlers, "publish_source_integration_event", published)

    with pytest.raises(RuntimeError, match="provider unavailable"):
        await watcher_handlers.handle_poll_source_connection(PollSourceConnection(connection_id))

    fail_watch_run.assert_awaited_once()
    failed_event = published.await_args_list[-1].kwargs
    assert failed_event["event_name"] == "workers.source_watchers.poll.failed"
    assert failed_event["status"] == "failed"
    assert failed_event["project_id"] == project_id
    assert failed_event["metadata"]["provider"] == "google_drive"
    assert failed_event["metadata"]["watcher_run_id"] == run_id
    assert isinstance(failed_event["error"], RuntimeError)


@pytest.mark.anyio
async def test_source_listener_provider_failure_records_failed_event(monkeypatch):
    connection_id = uuid4()
    project_id = uuid4()
    published = AsyncMock()

    monkeypatch.setattr(listener_handlers, "RedisLock", lambda *args, **kwargs: _FakeLock(True))
    monkeypatch.setattr(
        listener_handlers, "get_pool", AsyncMock(return_value=_FakePool(AsyncMock()))
    )
    monkeypatch.setattr(
        listener_handlers.repo,
        "fetch_connection",
        AsyncMock(
            return_value={
                "project_id": project_id,
                "provider": "google_drive",
                "source_connection_id": connection_id,
            }
        ),
    )
    monkeypatch.setattr(
        listener_handlers.provider_registry.registry,
        "resolve",
        lambda provider: _Provider(create_error=RuntimeError("listener unavailable")),
    )
    monkeypatch.setattr(listener_handlers, "publish_source_integration_event", published)

    with pytest.raises(RuntimeError, match="listener unavailable"):
        await listener_handlers.handle_create_listener(CreateListener(connection_id))

    failed_event = published.await_args.kwargs
    assert failed_event["event_name"] == "workers.source_listeners.create.failed"
    assert failed_event["status"] == "failed"
    assert failed_event["project_id"] == project_id
    assert failed_event["metadata"]["provider"] == "google_drive"
    assert failed_event["metadata"]["failure_stage"] == "provider_create"
    assert isinstance(failed_event["error"], RuntimeError)


class _AcquireContext:
    def __init__(self, conn) -> None:
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, exc_type, exc, traceback):
        return False


class _FakePool:
    def __init__(self, conn) -> None:
        self._conn = conn

    def acquire(self):
        return _AcquireContext(self._conn)


class _FakeLock:
    def __init__(self, acquired: bool) -> None:
        self.acquired = acquired

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False


class _Registry:
    def __init__(self, provider) -> None:
        self._provider = provider

    def resolve(self, provider: str):
        return self._provider


class _Provider:
    def __init__(self, *, discover_error=None, create_error=None) -> None:
        self._discover_error = discover_error
        self._create_error = create_error

    async def discover(self, connection, cursor):
        raise self._discover_error

    async def create(self, connection):
        raise self._create_error

import json
from unittest.mock import AsyncMock
from uuid import uuid4

from botocore.exceptions import ClientError
from fastapi import HTTPException
import pytest

from app.domains.pdf_storage import service as pdf_storage_service
from app.domains.pdf_storage.router import get_pdf_url, upload_pdf
from app.domains.shared import service as monitoring_service
from app.domains.shared.schemas import MonitoringEventInput
from app.domains.worker_dispatch import events


@pytest.mark.anyio
async def test_record_monitoring_event_persists_sanitized_payload_and_logs(caplog, monkeypatch):
    conn = AsyncMock()
    inserted = AsyncMock()
    visible_id = uuid4()
    monkeypatch.setattr(monitoring_service, "insert_monitoring_event", inserted)
    monkeypatch.setattr(monitoring_service, "delete_old_monitoring_events", AsyncMock())

    await monitoring_service.record_monitoring_event(
        conn,
        MonitoringEventInput(
            event_name="api.storage.pdf.upload",
            event_kind="storage",
            operation_type="mutation",
            source="api.pdf_storage",
            status="failure",
            metadata={
                "filename": "invoice.pdf",
                "authorization": "Bearer secret",
                "payload": b"%PDF",
                "nested": {"api_key": "secret", "visible": visible_id},
            },
            raw_error_payload={"body": b"%PDF", "cookie": "session"},
            error_type="HTTPException",
            error_message="bad upload",
        ),
    )

    event = inserted.await_args.args[1]
    assert event.severity == "error"
    assert event.metadata["filename"] == "invoice.pdf"
    assert event.metadata["payload"] == "[BinaryPayloadOmitted]"
    assert event.metadata["nested"] == {"visible": str(visible_id)}
    assert "authorization" not in event.metadata
    assert event.raw_error_payload == {"body": "[BinaryPayloadOmitted]"}

    log_payload = json.loads(caplog.records[-1].message)
    assert log_payload["service"] == "dokumen-api"
    assert log_payload["event_name"] == "api.storage.pdf.upload"
    assert log_payload["status"] == "failure"
    assert log_payload["error_type"] == "HTTPException"


@pytest.mark.anyio
async def test_monitoring_persistence_failure_does_not_raise(monkeypatch):
    monkeypatch.setattr(
        monitoring_service,
        "insert_monitoring_event",
        AsyncMock(side_effect=RuntimeError("monitoring db down")),
    )
    monkeypatch.setattr(monitoring_service, "delete_old_monitoring_events", AsyncMock())

    await monitoring_service.record_monitoring_event(
        AsyncMock(),
        MonitoringEventInput(
            event_name="api.worker_dispatch.optimize_prompt",
            event_kind="dispatch",
            operation_type="mutation",
            source="api.worker_dispatch",
            status="success",
        ),
    )


@pytest.mark.anyio
async def test_monitoring_retention_is_throttled(monkeypatch):
    inserted = AsyncMock()
    cleanup = AsyncMock()
    conn = AsyncMock()
    event = MonitoringEventInput(
        event_name="api.worker_dispatch.optimize_prompt",
        event_kind="dispatch",
        operation_type="mutation",
        source="api.worker_dispatch",
        status="success",
    )

    monkeypatch.setattr(monitoring_service, "insert_monitoring_event", inserted)
    monkeypatch.setattr(monitoring_service, "delete_old_monitoring_events", cleanup)
    monkeypatch.setattr(monitoring_service, "_last_retention_sweep_at", 100.0)
    monkeypatch.setattr(monitoring_service.time, "monotonic", lambda: 3701.0)

    await monitoring_service.record_monitoring_event(conn, event)
    await monitoring_service.record_monitoring_event(conn, event)

    cleanup.assert_awaited_once_with(conn, "180 days")
    assert inserted.await_count == 2


@pytest.mark.anyio
async def test_worker_dispatch_success_records_accepted_task(async_client, mock_redis, monkeypatch):
    project_id = uuid4()
    pdf_id = uuid4()
    task_id = "task-accepted"
    inserted = AsyncMock()
    monkeypatch.setattr(monitoring_service, "insert_monitoring_event", inserted)
    monkeypatch.setattr(monitoring_service, "delete_old_monitoring_events", AsyncMock())
    monkeypatch.setattr(events, "dispatch_optimize_prompt", lambda **kwargs: task_id)

    response = await async_client.post(
        "/api/v1/worker-dispatch/optimize-prompt",
        json={
            "project_id": str(project_id),
            "template_id": 1,
            "labeled_pdfs": [str(pdf_id)],
        },
    )

    assert response.status_code == 200
    event = inserted.await_args.args[1]
    assert event.event_name == "api.worker_dispatch.optimize_prompt"
    assert event.event_kind == "dispatch"
    assert event.status == "success"
    assert event.project_id == project_id
    assert event.task_id == task_id
    assert event.metadata["labeled_pdf_count"] == 1
    mock_redis.set.assert_awaited_once()


@pytest.mark.anyio
async def test_worker_dispatch_failure_records_failed_attempt(async_client, monkeypatch):
    project_id = uuid4()
    pdf_id = uuid4()
    inserted = AsyncMock()

    def fail_dispatch(**kwargs):
        raise RuntimeError("celery broker unavailable")

    monkeypatch.setattr(monitoring_service, "insert_monitoring_event", inserted)
    monkeypatch.setattr(monitoring_service, "delete_old_monitoring_events", AsyncMock())
    monkeypatch.setattr(events, "dispatch_optimize_prompt", fail_dispatch)

    with pytest.raises(RuntimeError, match="celery broker unavailable"):
        await async_client.post(
            "/api/v1/worker-dispatch/optimize-prompt",
            json={
                "project_id": str(project_id),
                "template_id": 1,
                "labeled_pdfs": [str(pdf_id)],
            },
        )

    event = inserted.await_args.args[1]
    assert event.event_name == "api.worker_dispatch.optimize_prompt"
    assert event.status == "failure"
    assert event.project_id == project_id
    assert event.task_id is None
    assert event.error_type == "RuntimeError"
    assert event.raw_error_payload["template_id"] == 1


@pytest.mark.anyio
async def test_presigned_url_success_skips_monitoring(monkeypatch):
    recorded = AsyncMock()
    pdf_id = uuid4()
    request = _FakeRequest({"x-request-id": "req-1"}, method="GET", path=f"/pdfs/{pdf_id}/url")

    monkeypatch.setattr(
        "app.domains.pdf_storage.router.record_monitoring_event",
        recorded,
    )
    monkeypatch.setattr(
        "app.domains.pdf_storage.router.service.generate_pdf_get_url",
        AsyncMock(return_value={"url": "https://signed.test", "expires_in": 3600}),
    )

    result = await get_pdf_url(request, pdf_id, x_user_id=str(uuid4()), conn=AsyncMock())

    assert result["url"] == "https://signed.test"
    recorded.assert_not_awaited()


@pytest.mark.anyio
async def test_presigned_url_failure_records_authz_failure(monkeypatch):
    recorded = AsyncMock()
    pdf_id = uuid4()
    request = _FakeRequest({"x-request-id": "req-1"}, method="GET", path=f"/pdfs/{pdf_id}/url")

    monkeypatch.setattr(
        "app.domains.pdf_storage.router.record_monitoring_event",
        recorded,
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_pdf_url(request, pdf_id, x_user_id=None, conn=AsyncMock())

    assert exc_info.value.status_code == 401
    event = recorded.await_args.args[1]
    assert event.event_name == "api.storage.pdf.presigned_url"
    assert event.operation_type == "read"
    assert event.status == "failure"
    assert event.metadata["failure_stage"] == "missing_user_header"


@pytest.mark.anyio
async def test_upload_route_failure_records_safe_metadata_not_body(monkeypatch):
    recorded = AsyncMock()
    monkeypatch.setattr(
        "app.domains.pdf_storage.router.record_monitoring_event",
        recorded,
    )
    project_id = uuid4()
    bucket_id = uuid4()
    request = _FakeRequest(
        {
            "content-type": "image/png",
            "content-length": "36",
            "x-filename": "bad.png",
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        await upload_pdf(
            request,
            project_id=project_id,
            bucket_id=bucket_id,
            conn=AsyncMock(),
        )

    assert exc_info.value.status_code == 415
    event = recorded.await_args.args[1]
    assert event.event_name == "api.storage.pdf.upload"
    assert event.status == "failure"
    assert event.raw_error_payload == event.metadata
    assert event.metadata["content_type"] == "image/png"
    assert event.metadata["filename"] == "bad.png"
    assert "body" not in event.metadata


@pytest.mark.anyio
async def test_upload_rollback_failure_records_failure_event(monkeypatch):
    bucket_id = uuid4()
    project_id = uuid4()
    pdf_id = uuid4()
    conn = AsyncMock()
    request = _StreamRequest(
        {"content-type": "application/pdf", "content-length": "9", "x-filename": "doc.pdf"},
        [b"%PDF-body"],
    )
    recorded = AsyncMock()
    mock_s3 = _FailingMultipartS3()

    monkeypatch.setattr(
        "app.domains.pdf_storage.service.fetch_bucket_by_id",
        AsyncMock(
            return_value={
                "id": bucket_id,
                "name": "bucket",
                "region": "us-east-1",
                "endpoint_url": None,
            }
        ),
    )
    monkeypatch.setattr(
        "app.domains.pdf_storage.service.repository.insert_pdf",
        AsyncMock(return_value=pdf_id),
    )
    monkeypatch.setattr("app.domains.pdf_storage.service.repository.delete_pdf", AsyncMock())
    monkeypatch.setattr(
        "app.domains.pdf_storage.service.boto3.client", lambda *args, **kwargs: mock_s3
    )
    monkeypatch.setattr(
        "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
        AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
    )
    monkeypatch.setattr("app.domains.pdf_storage.service.record_monitoring_event", recorded)

    with pytest.raises(HTTPException) as exc_info:
        await pdf_storage_service.upload_pdf_stream(
            conn,
            bucket_id,
            project_id,
            "doc.pdf",
            request,
            uploaded_by_user_id="user-1",
        )

    assert exc_info.value.status_code == 502
    event = recorded.await_args.args[1]
    assert event.event_name == "api.storage.pdf.upload.rollback"
    assert event.status == "failure"
    assert event.metadata["abort_succeeded"] is False
    assert event.metadata["filename"] == "doc.pdf"
    assert "body" not in event.metadata
    assert event.error_type == "ClientError"


class _FakeUrl:
    def __init__(self, path: str) -> None:
        self.path = path


class _FakeRequest:
    def __init__(
        self,
        headers: dict[str, str],
        *,
        method: str = "POST",
        path: str = "/api/v1/pdf-storage/pdfs",
    ) -> None:
        self.headers = headers
        self.method = method
        self.url = _FakeUrl(path)


class _StreamRequest(_FakeRequest):
    def __init__(self, headers: dict[str, str], chunks: list[bytes]) -> None:
        super().__init__(headers)
        self._chunks = chunks

    async def stream(self):
        for chunk in self._chunks:
            yield chunk


class _FailingMultipartS3:
    def create_multipart_upload(self, **kwargs):
        return {"UploadId": "upload-1"}

    def upload_part(self, **kwargs):
        raise _client_error("AccessDenied", "upload denied")

    def abort_multipart_upload(self, **kwargs):
        raise _client_error("AccessDenied", "abort denied")


def _client_error(code: str, message: str) -> ClientError:
    return ClientError(
        error_response={"Error": {"Code": code, "Message": message}},
        operation_name="op",
    )

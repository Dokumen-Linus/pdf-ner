from uuid import uuid4

import pytest

from app.domains.source_watchers.application.schemas import DiscoveredDocumentPayload
from app.domains.source_watchers.infrastructure import provider_registry
from app.domains.source_watchers.infrastructure.materializers import PostgresDocumentMaterializer
from app.domains.source_watchers.infrastructure.repositories import (
    fail_watch_run,
    fetch_connection,
    fetch_cursor,
)


class AsyncTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False


class FakeConnection:
    def __init__(self) -> None:
        self.fetchrow_results = []
        self.fetchval_results = []
        self.execute_calls = []
        self.fetchrow_calls = []
        self.fetchval_calls = []

    async def fetchrow(self, query, *args):
        self.fetchrow_calls.append((query, args))
        return self.fetchrow_results.pop(0)

    async def fetchval(self, query, *args):
        self.fetchval_calls.append((query, args))
        return self.fetchval_results.pop(0)

    async def execute(self, query, *args):
        self.execute_calls.append((query, args))

    def transaction(self):
        return AsyncTransaction()


@pytest.mark.anyio
async def test_fetch_connection_decodes_jsonb_config_string():
    connection_id = uuid4()
    conn = FakeConnection()
    conn.fetchrow_results.append(
        {
            "id": connection_id,
            "project_id": uuid4(),
            "optimized_prompt_id": uuid4(),
            "provider": "google_drive",
            "display_name": "Drive",
            "config": '{"access_token":"token","bucket_id":"00000000-0000-0000-0000-000000000001"}',
            "poll_interval_seconds": 300,
        }
    )

    result = await fetch_connection(conn, connection_id)

    assert result is not None
    assert result["config"]["access_token"] == "token"
    assert result["config"]["bucket_id"] == "00000000-0000-0000-0000-000000000001"


@pytest.mark.anyio
async def test_fetch_cursor_decodes_jsonb_cursor_string():
    conn = FakeConnection()
    conn.fetchrow_results.append({"cursor": '{"page_token":"next"}'})

    result = await fetch_cursor(conn, uuid4())

    assert result == {"page_token": "next"}


@pytest.mark.anyio
async def test_fail_watch_run_sets_future_retry_time():
    conn = FakeConnection()

    await fail_watch_run(
        conn,
        uuid4(),
        uuid4(),
        error_type="RuntimeError",
        error_message="provider unavailable",
    )

    sync_state_query = conn.execute_calls[1][0]
    assert "next_poll_at" in sync_state_query
    assert "interval '60 seconds'" in sync_state_query
    assert "POWER(2" in sync_state_query


def test_build_registry_wires_materializer_into_production_watchers():
    conn = FakeConnection()
    registry = provider_registry.build_registry(conn)

    assert registry.resolve("google_drive").materializer is not None
    assert registry.resolve("onedrive").materializer is not None


@pytest.mark.anyio
async def test_postgres_materializer_creates_pdf_and_document_source():
    conn = FakeConnection()
    project_id = uuid4()
    connection_id = uuid4()
    bucket_id = uuid4()
    pdf_id = uuid4()
    source_id = uuid4()
    conn.fetchrow_results.append(None)
    conn.fetchval_results.extend([source_id, pdf_id])
    materializer = PostgresDocumentMaterializer(conn)

    result = await materializer.materialize(
        {
            "id": connection_id,
            "project_id": project_id,
            "config": {"bucket_id": str(bucket_id), "filepath_prefix": "incoming"},
        },
        DiscoveredDocumentPayload(
            external_id="file-1",
            external_version="v1",
            uri="https://provider.test/file-1",
            fingerprint="hash",
            name="invoice.pdf",
            metadata={"provider": "google_drive"},
        ),
    )

    assert result.source_id == source_id
    assert result.pdf_id == pdf_id
    assert result.is_new is True
    assert (
        conn.fetchval_calls[1][1][1] == f"{project_id}/incoming/{connection_id}/file-1/invoice.pdf"
    )
    assert "'queued'" in conn.fetchval_calls[0][0]


@pytest.mark.anyio
async def test_postgres_materializer_reuses_existing_document_source():
    conn = FakeConnection()
    pdf_id = uuid4()
    source_id = uuid4()
    conn.fetchrow_results.append({"id": source_id, "pdf_id": pdf_id})
    materializer = PostgresDocumentMaterializer(conn)

    result = await materializer.materialize(
        {"id": uuid4(), "project_id": uuid4(), "config": {}},
        DiscoveredDocumentPayload(external_id="file-1", external_version="v1"),
    )

    assert result.source_id == source_id
    assert result.pdf_id == pdf_id
    assert result.is_new is False
    assert conn.fetchval_calls == []

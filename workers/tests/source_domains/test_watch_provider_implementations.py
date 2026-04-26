from uuid import uuid4

import httpx
import pytest

from app.domains.source_watchers.application.schemas import MaterializedDocumentPayload
from app.domains.source_watchers.infrastructure.providers.google_drive import GoogleDriveWatcher
from app.domains.source_watchers.infrastructure.providers.onedrive import OneDriveWatcher


class FakeMaterializer:
    async def materialize(self, connection, document):
        return MaterializedDocumentPayload(
            document_source_id=uuid4(),
            pdf_id=uuid4(),
            is_new=True,
        )


@pytest.mark.anyio
async def test_google_drive_watcher_discovers_changes_and_materializes():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/changes/startPageToken"):
            return httpx.Response(200, json={"startPageToken": "start-1"})
        return httpx.Response(
            200,
            json={
                "newStartPageToken": "next-1",
                "changes": [
                    {
                        "fileId": "file-1",
                        "time": "2026-04-26T12:00:00Z",
                        "file": {
                            "id": "file-1",
                            "name": "invoice.pdf",
                            "mimeType": "application/pdf",
                            "modifiedTime": "2026-04-26T12:00:00Z",
                            "webViewLink": "https://drive.test/file-1",
                        },
                    }
                ],
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://www.googleapis.com",
    ) as client:
        watcher = GoogleDriveWatcher(client=client, materializer=FakeMaterializer())
        result = await watcher.discover(
            {"config": {"access_token": "token"}},
            cursor=None,
        )

    assert result.cursor.value == {"page_token": "next-1"}
    assert result.documents[0].external_id == "file-1"
    assert result.documents[0].materialized is not None
    assert requests[1].url.params["pageToken"] == "start-1"


@pytest.mark.anyio
async def test_onedrive_watcher_uses_delta_link_and_materializes_files():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "@odata.deltaLink": "https://graph.test/delta-token",
                "value": [
                    {
                        "id": "item-1",
                        "name": "contract.pdf",
                        "eTag": "abc",
                        "webUrl": "https://graph.test/item-1",
                        "file": {"hashes": {"quickXorHash": "hash"}},
                    },
                    {"id": "folder-1", "name": "folder"},
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        watcher = OneDriveWatcher(client=client, materializer=FakeMaterializer())
        result = await watcher.discover(
            {"config": {"access_token": "token", "drive_id": "drive-1"}},
            cursor=None,
        )

    assert result.cursor.value == {"delta_link": "https://graph.test/delta-token"}
    assert [doc.external_id for doc in result.documents] == ["item-1"]
    assert captured[0].url.path == "/v1.0/drives/drive-1/items/root/delta"

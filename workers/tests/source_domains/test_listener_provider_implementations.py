from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.domains.source_listeners.infrastructure.providers.azure_blob import AzureBlobListener
from app.domains.source_listeners.infrastructure.providers.gcs import GoogleCloudStorageListener
from app.domains.source_listeners.infrastructure.providers.gmail import GmailListener
from app.domains.source_listeners.infrastructure.providers.google_drive import GoogleDriveListener
from app.domains.source_listeners.infrastructure.providers.graph import (
    OneDriveListener,
    OutlookEmailListener,
)
from app.domains.source_listeners.infrastructure.providers.s3 import S3Listener


@pytest.mark.anyio
async def test_outlook_listener_creates_graph_subscription():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            201,
            json={"id": "sub-1", "expirationDateTime": "2026-04-26T12:30:00Z"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await OutlookEmailListener(client=client).create(
            {
                "id": uuid4(),
                "config": {
                    "access_token": "token",
                    "callback_url": "https://app.test/webhook",
                    "client_state": "secret",
                },
            }
        )

    assert result.provider_subscription_id == "sub-1"
    assert result.secret_ref == "secret"
    assert captured[0].url.path == "/v1.0/subscriptions"
    assert captured[0].headers["authorization"] == "Bearer token"
    assert b'"resource":"me/messages"' in captured[0].content


@pytest.mark.anyio
async def test_onedrive_listener_uses_graph_drive_resource():
    def handler(request: httpx.Request) -> httpx.Response:
        assert b'"resource":"me/drive/root"' in request.content
        return httpx.Response(
            201,
            json={"id": "sub-drive", "expirationDateTime": "2026-04-26T12:30:00Z"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await OneDriveListener(client=client).create(
            {"id": uuid4(), "config": {"access_token": "token", "callback_url": "https://app.test"}}
        )

    assert result.provider_subscription_id == "sub-drive"


@pytest.mark.anyio
async def test_gmail_listener_creates_watch():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"historyId": "123"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await GmailListener(client=client).create(
            {
                "id": uuid4(),
                "config": {
                    "access_token": "token",
                    "topic_name": "projects/p/topics/t",
                    "label_ids": ["INBOX"],
                },
            }
        )

    assert result.provider_subscription_id == "123"
    assert captured[0].url.path == "/gmail/v1/users/me/watch"
    assert b"projects/p/topics/t" in captured[0].content


@pytest.mark.anyio
async def test_google_drive_listener_creates_changes_watch():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["pageToken"] == "page-1"
        assert b'"type":"web_hook"' in request.content
        return httpx.Response(200, json={"resourceId": "res-1"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await GoogleDriveListener(client=client).create(
            {
                "id": uuid4(),
                "config": {
                    "access_token": "token",
                    "page_token": "page-1",
                    "callback_url": "https://app.test/drive",
                },
            }
        )

    assert result.provider_subscription_id == "res-1"


@pytest.mark.anyio
async def test_gcs_listener_creates_object_watch():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"resourceId": "gcs-res"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await GoogleCloudStorageListener(client=client).create(
            {
                "id": uuid4(),
                "config": {
                    "access_token": "token",
                    "bucket": "docs",
                    "callback_url": "https://app.test/gcs",
                },
            }
        )

    assert result.provider_subscription_id == "gcs-res"
    assert captured[0].url.path == "/storage/v1/b/docs/o/watch"


@pytest.mark.anyio
async def test_azure_blob_listener_creates_event_grid_subscription():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"id": "azure-sub"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await AzureBlobListener(client=client).create(
            {
                "id": "sub-name",
                "config": {
                    "access_token": "token",
                    "scope": "/subscriptions/s/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/a",
                    "callback_url": "https://app.test/azure",
                },
            }
        )

    assert result.provider_subscription_id == "azure-sub"
    assert captured[0].url.params["api-version"] == "2022-06-15"
    assert b"Microsoft.Storage.BlobCreated" in captured[0].content


@pytest.mark.anyio
async def test_s3_listener_puts_bucket_notification_configuration():
    s3_client = MagicMock()
    s3_client.get_bucket_notification_configuration.return_value = {"QueueConfigurations": []}

    with patch(
        "app.domains.source_listeners.infrastructure.providers.s3.boto3.client",
        return_value=s3_client,
    ):
        result = await S3Listener().create(
            {
                "id": "conn-1",
                "config": {
                    "bucket": "docs",
                    "queue_arn": "arn:aws:sqs:us-east-1:123:queue",
                    "events": ["s3:ObjectCreated:*"],
                    "prefix": "incoming/",
                },
            }
        )

    assert result.provider_subscription_id == "conn-1"
    s3_client.put_bucket_notification_configuration.assert_called_once()
    notification = s3_client.put_bucket_notification_configuration.call_args.kwargs[
        "NotificationConfiguration"
    ]
    assert notification["QueueConfigurations"][0]["QueueArn"].endswith(":queue")

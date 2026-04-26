from __future__ import annotations

from uuid import uuid4

import httpx

from ...application.schemas import ListenerEventPayload, ListenerProvisioningPayload
from .common import empty_event, request_json, require_config


class GoogleCloudStorageListener:
    """Create Cloud Storage object change notification channels."""

    def __init__(
        self,
        *,
        client: httpx.AsyncClient | None = None,
        base_url: str = "https://www.googleapis.com/storage/v1",
    ) -> None:
        self.client = client
        self.base_url = base_url.rstrip("/")

    async def create(self, connection: dict) -> ListenerProvisioningPayload:
        config = dict(connection.get("config") or {})
        token = require_config(config, "access_token")
        bucket = require_config(config, "bucket")
        callback_url = require_config(config, "callback_url")
        channel_id = config.get("channel_id", str(uuid4()))
        body = {
            "id": channel_id,
            "type": "web_hook",
            "address": callback_url,
        }
        if isinstance(config.get("client_token"), str):
            body["token"] = config["client_token"]

        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await request_json(
                client,
                "POST",
                f"{self.base_url}/b/{bucket}/o/watch",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json_body=body,
            )
        finally:
            if close_client:
                await client.aclose()
        return ListenerProvisioningPayload(
            provider_subscription_id=payload.get("resourceId"),
            callback_url=callback_url,
            secret_ref=body.get("token"),
            provider_payload={**payload, "access_token": token, "channel_id": channel_id},
        )

    async def renew(self, subscription: dict) -> ListenerProvisioningPayload:
        raise NotImplementedError("GCS object channels are renewed by creating a new channel")

    async def disable(self, subscription: dict) -> None:
        payload = dict(subscription.get("provider_payload") or {})
        token = require_config(payload, "access_token")
        channel_id = require_config(payload, "channel_id")
        resource_id = require_config(subscription, "provider_subscription_id")
        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            response = await client.post(
                f"{self.base_url}/channels/stop",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"id": channel_id, "resourceId": resource_id},
            )
            response.raise_for_status()
        finally:
            if close_client:
                await client.aclose()

    async def normalize_event(
        self, subscription: dict, event_payload: dict
    ) -> ListenerEventPayload:
        return empty_event(subscription["id"], event_payload)

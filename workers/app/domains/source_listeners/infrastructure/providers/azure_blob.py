from __future__ import annotations

import httpx

from ...application.schemas import ListenerEventPayload, ListenerProvisioningPayload
from .common import default_expiration, empty_event, request_json, require_config


class AzureBlobListener:
    """Create Azure Event Grid webhook subscriptions for blob-created events."""

    def __init__(self, *, client: httpx.AsyncClient | None = None) -> None:
        self.client = client

    async def create(self, connection: dict) -> ListenerProvisioningPayload:
        config = dict(connection.get("config") or {})
        token = require_config(config, "access_token")
        scope = require_config(config, "scope")
        subscription_name = config.get("subscription_name", str(connection["id"]))
        callback_url = require_config(config, "callback_url")
        api_version = config.get("api_version", "2022-06-15")
        expiration = default_expiration(int(config.get("expiration_minutes", 43200)))
        url = f"https://management.azure.com{scope}/providers/Microsoft.EventGrid/eventSubscriptions/{subscription_name}"
        body = {
            "properties": {
                "destination": {
                    "endpointType": "WebHook",
                    "properties": {"endpointUrl": callback_url},
                },
                "filter": {
                    "includedEventTypes": config.get(
                        "included_event_types", ["Microsoft.Storage.BlobCreated"]
                    )
                },
                "expirationTimeUtc": expiration.isoformat().replace("+00:00", "Z"),
            }
        }

        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await request_json(
                client,
                "PUT",
                url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                params={"api-version": api_version},
                json_body=body,
            )
        finally:
            if close_client:
                await client.aclose()
        return ListenerProvisioningPayload(
            provider_subscription_id=payload.get("id", subscription_name),
            callback_url=callback_url,
            expires_at=expiration,
            provider_payload={**payload, "access_token": token, "api_version": api_version},
        )

    async def renew(self, subscription: dict) -> ListenerProvisioningPayload:
        raise NotImplementedError("Azure Event Grid renewal should recreate/update the subscription")

    async def disable(self, subscription: dict) -> None:
        payload = dict(subscription.get("provider_payload") or {})
        token = require_config(payload, "access_token")
        provider_subscription_id = require_config(subscription, "provider_subscription_id")
        api_version = payload.get("api_version", "2022-06-15")
        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            response = await client.delete(
                provider_subscription_id,
                headers={"Authorization": f"Bearer {token}"},
                params={"api-version": api_version},
            )
            response.raise_for_status()
        finally:
            if close_client:
                await client.aclose()

    async def normalize_event(self, subscription: dict, event_payload: dict) -> ListenerEventPayload:
        return empty_event(subscription["id"], event_payload)


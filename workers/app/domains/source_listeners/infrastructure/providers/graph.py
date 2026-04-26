from __future__ import annotations

import httpx

from ...application.schemas import ListenerEventPayload, ListenerProvisioningPayload
from .common import (
    bearer_headers,
    default_expiration,
    empty_event,
    provisioning_from_payload,
    request_json,
    require_config,
)


class GraphSubscriptionListener:
    def __init__(
        self,
        *,
        resource: str,
        change_type: str,
        client: httpx.AsyncClient | None = None,
        base_url: str = "https://graph.microsoft.com/v1.0",
    ) -> None:
        self.resource = resource
        self.change_type = change_type
        self.client = client
        self.base_url = base_url.rstrip("/")

    async def create(self, connection: dict) -> ListenerProvisioningPayload:
        config = dict(connection.get("config") or {})
        token = require_config(config, "access_token")
        callback_url = require_config(config, "callback_url")
        client_state = config.get("client_state")
        expires_at = default_expiration(int(config.get("expiration_minutes", 4230)))
        body = {
            "changeType": config.get("change_type", self.change_type),
            "notificationUrl": callback_url,
            "resource": config.get("resource", self.resource),
            "expirationDateTime": expires_at.isoformat().replace("+00:00", "Z"),
        }
        if isinstance(client_state, str) and client_state:
            body["clientState"] = client_state

        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await request_json(
                client,
                "POST",
                f"{self.base_url}/subscriptions",
                headers=bearer_headers(token),
                json_body=body,
            )
        finally:
            if close_client:
                await client.aclose()
        result = provisioning_from_payload(
            payload,
            callback_url=callback_url,
            secret_ref=client_state if isinstance(client_state, str) else None,
        )
        result.provider_payload = {**result.provider_payload, "access_token": token}
        return result

    async def renew(self, subscription: dict) -> ListenerProvisioningPayload:
        config = dict(subscription.get("provider_payload") or {})
        token = require_config(config, "access_token")
        provider_subscription_id = require_config(subscription, "provider_subscription_id")
        expires_at = default_expiration(int(config.get("expiration_minutes", 4230)))
        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await request_json(
                client,
                "PATCH",
                f"{self.base_url}/subscriptions/{provider_subscription_id}",
                headers=bearer_headers(token),
                json_body={"expirationDateTime": expires_at.isoformat().replace("+00:00", "Z")},
            )
        finally:
            if close_client:
                await client.aclose()
        result = provisioning_from_payload(payload)
        result.provider_payload = {**result.provider_payload, "access_token": token}
        return result

    async def disable(self, subscription: dict) -> None:
        config = dict(subscription.get("provider_payload") or {})
        token = require_config(config, "access_token")
        provider_subscription_id = require_config(subscription, "provider_subscription_id")
        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            response = await client.delete(
                f"{self.base_url}/subscriptions/{provider_subscription_id}",
                headers=bearer_headers(token),
            )
            response.raise_for_status()
        finally:
            if close_client:
                await client.aclose()

    async def normalize_event(self, subscription: dict, event_payload: dict) -> ListenerEventPayload:
        return empty_event(subscription["id"], event_payload)


class OutlookEmailListener(GraphSubscriptionListener):
    def __init__(self, **kwargs) -> None:
        super().__init__(resource="me/messages", change_type="created,updated", **kwargs)


class OneDriveListener(GraphSubscriptionListener):
    def __init__(self, **kwargs) -> None:
        super().__init__(resource="me/drive/root", change_type="updated", **kwargs)

from __future__ import annotations

import httpx

from ...application.schemas import ListenerEventPayload, ListenerProvisioningPayload
from .common import bearer_headers, empty_event, request_json, require_config


class GmailListener:
    def __init__(
        self,
        *,
        client: httpx.AsyncClient | None = None,
        base_url: str = "https://gmail.googleapis.com/gmail/v1",
    ) -> None:
        self.client = client
        self.base_url = base_url.rstrip("/")

    async def create(self, connection: dict) -> ListenerProvisioningPayload:
        config = dict(connection.get("config") or {})
        token = require_config(config, "access_token")
        user_id = config.get("user_id", "me")
        body = {"topicName": require_config(config, "topic_name")}
        if isinstance(config.get("label_ids"), list):
            body["labelIds"] = config["label_ids"]
        if isinstance(config.get("label_filter_behavior"), str):
            body["labelFilterBehavior"] = config["label_filter_behavior"]

        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await request_json(
                client,
                "POST",
                f"{self.base_url}/users/{user_id}/watch",
                headers=bearer_headers(token),
                json_body=body,
            )
        finally:
            if close_client:
                await client.aclose()
        return ListenerProvisioningPayload(
            provider_subscription_id=str(payload.get("historyId") or ""),
            provider_payload={**payload, "access_token": token, "user_id": user_id},
        )

    async def renew(self, subscription: dict) -> ListenerProvisioningPayload:
        connection = {"config": subscription.get("provider_payload") or {}}
        return await self.create(connection)

    async def disable(self, subscription: dict) -> None:
        payload = dict(subscription.get("provider_payload") or {})
        token = require_config(payload, "access_token")
        user_id = payload.get("user_id", "me")
        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            response = await client.post(
                f"{self.base_url}/users/{user_id}/stop",
                headers=bearer_headers(token),
            )
            response.raise_for_status()
        finally:
            if close_client:
                await client.aclose()

    async def normalize_event(
        self, subscription: dict, event_payload: dict
    ) -> ListenerEventPayload:
        return empty_event(subscription["id"], event_payload)

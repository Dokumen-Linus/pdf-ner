from __future__ import annotations

import httpx

from ...application.schemas import (
    DiscoveredDocumentPayload,
    ProviderCursorPayload,
    WatchDiscoveryResult,
)
from .common import DocumentMaterializer, bearer_headers, get_json, require_config


class OneDriveWatcher:
    """Poll Microsoft Graph delta queries and delegate file materialization."""

    def __init__(
        self,
        *,
        client: httpx.AsyncClient | None = None,
        materializer: DocumentMaterializer | None = None,
        base_url: str = "https://graph.microsoft.com/v1.0",
    ) -> None:
        self.client = client
        self.materializer = materializer
        self.base_url = base_url.rstrip("/")

    async def discover(self, connection: dict, cursor: dict | None) -> WatchDiscoveryResult:
        config = dict(connection.get("config") or {})
        access_token = require_config(config, "access_token")
        delta_url = (cursor or {}).get("delta_link")
        url = delta_url if isinstance(delta_url, str) and delta_url else self._initial_delta_url(config)

        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await get_json(client, url, headers=bearer_headers(access_token))
        finally:
            if close_client:
                await client.aclose()

        documents: list[DiscoveredDocumentPayload] = []
        for item in payload.get("value", []):
            if not isinstance(item, dict) or "deleted" in item or "file" not in item:
                continue
            document = DiscoveredDocumentPayload(
                external_id=str(item["id"]),
                external_version=str(item.get("eTag") or item.get("lastModifiedDateTime") or ""),
                uri=item.get("webUrl"),
                fingerprint=(item.get("file") or {}).get("hashes", {}).get("quickXorHash"),
                name=item.get("name"),
                metadata={"provider": "onedrive", "item": item},
            )
            if self.materializer is not None:
                document.materialized = await self.materializer.materialize(connection, document)
            documents.append(document)

        delta_link = payload.get("@odata.deltaLink") or payload.get("@odata.nextLink") or url
        return WatchDiscoveryResult(
            cursor=ProviderCursorPayload(value={"delta_link": delta_link}),
            documents=documents,
        )

    def _initial_delta_url(self, config: dict) -> str:
        drive_id = config.get("drive_id")
        item_id = config.get("item_id", "root")
        if isinstance(drive_id, str) and drive_id:
            return f"{self.base_url}/drives/{drive_id}/items/{item_id}/delta"
        user_id = config.get("user_id", "me")
        return f"{self.base_url}/users/{user_id}/drive/items/{item_id}/delta"


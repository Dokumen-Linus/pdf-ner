from __future__ import annotations

import httpx

from ...application.schemas import (
    DiscoveredDocumentPayload,
    ProviderCursorPayload,
    WatchDiscoveryResult,
)
from .common import DocumentMaterializer, bearer_headers, get_json, optional_config, require_config


class GoogleDriveWatcher:
    """Poll Google Drive changes.list and delegate file materialization."""

    def __init__(
        self,
        *,
        client: httpx.AsyncClient | None = None,
        materializer: DocumentMaterializer | None = None,
        base_url: str = "https://www.googleapis.com/drive/v3",
    ) -> None:
        self.client = client
        self.materializer = materializer
        self.base_url = base_url.rstrip("/")

    async def discover(self, connection: dict, cursor: dict | None) -> WatchDiscoveryResult:
        config = dict(connection.get("config") or {})
        access_token = require_config(config, "access_token")
        page_token = (cursor or {}).get("page_token") or config.get("start_page_token")
        if not isinstance(page_token, str) or not page_token:
            page_token = await self._fetch_start_page_token(access_token)

        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await get_json(
                client,
                f"{self.base_url}/changes",
                headers=bearer_headers(access_token),
                params={
                    "pageToken": page_token,
                    "pageSize": int(config.get("page_size", 100)),
                    "fields": config.get(
                        "fields",
                        "changes(fileId,removed,time,file(id,name,mimeType,md5Checksum,modifiedTime,webViewLink)),newStartPageToken,nextPageToken",
                    ),
                    "supportsAllDrives": "true",
                    "includeItemsFromAllDrives": "true",
                    **self._drive_params(config),
                },
            )
        finally:
            if close_client:
                await client.aclose()

        documents: list[DiscoveredDocumentPayload] = []
        for change in payload.get("changes", []):
            if not isinstance(change, dict) or change.get("removed"):
                continue
            file_payload = change.get("file")
            if not isinstance(file_payload, dict):
                continue
            document = DiscoveredDocumentPayload(
                external_id=str(file_payload.get("id") or change.get("fileId")),
                external_version=str(file_payload.get("modifiedTime") or change.get("time") or ""),
                uri=file_payload.get("webViewLink"),
                fingerprint=file_payload.get("md5Checksum"),
                name=file_payload.get("name"),
                metadata={"provider": "google_drive", "change": change},
            )
            if self.materializer is not None:
                document.materialized = await self.materializer.materialize(connection, document)
            documents.append(document)

        next_token = payload.get("nextPageToken") or payload.get("newStartPageToken") or page_token
        return WatchDiscoveryResult(
            cursor=ProviderCursorPayload(value={"page_token": next_token}),
            documents=documents,
        )

    async def _fetch_start_page_token(self, access_token: str) -> str:
        close_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=30.0)
        try:
            payload = await get_json(
                client,
                f"{self.base_url}/changes/startPageToken",
                headers=bearer_headers(access_token),
            )
        finally:
            if close_client:
                await client.aclose()
        token = payload.get("startPageToken")
        if not isinstance(token, str) or not token:
            raise ValueError("Google Drive startPageToken response is missing startPageToken")
        return token

    @staticmethod
    def _drive_params(config: dict) -> dict[str, str]:
        drive_id = optional_config(config, "drive_id")
        if drive_id is None:
            return {}
        return {"driveId": drive_id, "corpora": "drive"}


from __future__ import annotations

from typing import Protocol

import httpx

from ...application.schemas import DiscoveredDocumentPayload, MaterializedDocumentPayload


class DocumentMaterializer(Protocol):
    async def materialize(
        self,
        connection: dict,
        document: DiscoveredDocumentPayload,
    ) -> MaterializedDocumentPayload: ...


def require_config(config: dict, key: str) -> str:
    value = config.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"Missing source provider config value '{key}'")
    return value


def optional_config(config: dict, key: str) -> str | None:
    value = config.get(key)
    return value if isinstance(value, str) and value else None


def bearer_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


async def get_json(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str],
    params: dict | None = None,
) -> dict:
    response = await client.get(url, headers=headers, params=params)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("Provider response must be a JSON object")
    return payload

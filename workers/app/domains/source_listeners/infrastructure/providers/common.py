from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx

from ...application.schemas import ListenerEventPayload, ListenerProvisioningPayload


def require_config(config: dict, key: str) -> str:
    value = config.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"Missing source provider config value '{key}'")
    return value


def optional_config(config: dict, key: str) -> str | None:
    value = config.get(key)
    return value if isinstance(value, str) and value else None


def bearer_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def default_expiration(minutes: int) -> datetime:
    return datetime.now(UTC) + timedelta(minutes=minutes)


async def request_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    json_body: dict | None = None,
    params: dict | None = None,
) -> dict:
    response = await client.request(method, url, headers=headers, json=json_body, params=params)
    response.raise_for_status()
    if not response.content:
        return {}
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("Provider response must be a JSON object")
    return payload


def empty_event(subscription_id, raw_event: dict) -> ListenerEventPayload:
    return ListenerEventPayload(
        listener_subscription_id=subscription_id,
        documents=[],
        raw_event=raw_event,
    )


def provisioning_from_payload(
    payload: dict,
    *,
    provider_subscription_id_key: str = "id",
    callback_url: str | None = None,
    secret_ref: str | None = None,
    expires_at_key: str = "expirationDateTime",
) -> ListenerProvisioningPayload:
    expires_raw = payload.get(expires_at_key)
    expires_at = None
    if isinstance(expires_raw, str) and expires_raw:
        expires_at = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
    return ListenerProvisioningPayload(
        provider_subscription_id=payload.get(provider_subscription_id_key),
        callback_url=callback_url,
        secret_ref=secret_ref,
        expires_at=expires_at,
        renew_after=(expires_at - timedelta(minutes=15)) if expires_at else None,
        provider_payload=payload,
    )

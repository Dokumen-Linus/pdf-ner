from __future__ import annotations

from collections.abc import Mapping, Sequence
import json
import os
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

_CACHE: dict[tuple[str, str], dict[str, Any]] = {}


class SecretConfigError(RuntimeError):
    pass


def _client(region: str):
    return boto3.client("secretsmanager", region_name=region)


def load_secret_json(secret_name: str, region: str) -> dict[str, Any]:
    """Load one Secrets Manager JSON object using AWS's default credential chain.

    Values are cached in-process for the lifetime of the app. Rotate secrets by
    updating Secrets Manager and restarting the container.
    """
    cache_key = (region, secret_name)
    cached = _CACHE.get(cache_key)
    if cached is not None:
        return dict(cached)

    try:
        response = _client(region).get_secret_value(SecretId=secret_name)
    except (BotoCoreError, ClientError) as exc:
        raise SecretConfigError(f"Failed to load AWS secret {secret_name!r}") from exc

    secret_string = response.get("SecretString")
    if not isinstance(secret_string, str):
        raise SecretConfigError(f"AWS secret {secret_name!r} must contain SecretString JSON")

    try:
        parsed = json.loads(secret_string)
    except json.JSONDecodeError as exc:
        raise SecretConfigError(f"AWS secret {secret_name!r} contains invalid JSON") from exc

    if not isinstance(parsed, dict):
        raise SecretConfigError(f"AWS secret {secret_name!r} must be a JSON object")

    _CACHE[cache_key] = dict(parsed)
    return dict(parsed)


def load_stage_groups(
    *,
    groups: Sequence[str],
    stage: str | None = None,
    region: str | None = None,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Load and merge secret groups such as prod/api and prod/runpod.

    If stage is unset, returns an empty dict so local development and tests can
    keep using normal environment variables and .env files.
    """
    env = environ or os.environ
    resolved_stage = stage if stage is not None else env.get("SECRETS_STAGE")
    if not resolved_stage:
        return {}

    resolved_region = region or env.get("AWS_REGION")
    if not resolved_region:
        raise SecretConfigError("AWS_REGION is required when SECRETS_STAGE is set")

    merged: dict[str, Any] = {}
    for group in groups:
        merged.update(load_secret_json(f"{resolved_stage}/{group}", resolved_region))
    return merged

from __future__ import annotations

import json

import botocore.exceptions
import pytest

from dokumen_aws_secrets import config
from dokumen_aws_secrets.config import SecretConfigError


class FakeSecretsClient:
    def __init__(self, payloads):
        self.payloads = payloads

    def get_secret_value(self, *, SecretId: str):
        payload = self.payloads[SecretId]
        if isinstance(payload, Exception):
            raise payload
        return payload


@pytest.fixture(autouse=True)
def reset_cache():
    config._CACHE.clear()


def test_load_secret_json_wraps_boto_error(monkeypatch):
    class BrokenClient:
        def get_secret_value(self, **kwargs):
            raise botocore.exceptions.ClientError(
                {"Error": {"Code": "AccessDeniedException", "Message": "no network"}},
                "get_secret_value",
            )

    monkeypatch.setattr(config, "_client", lambda region: BrokenClient())

    with pytest.raises(SecretConfigError, match="Failed to load AWS secret"):
        config.load_secret_json("prod/api", "us-east-1")


def test_load_secret_json_wraps_invalid_json(monkeypatch):
    client = FakeSecretsClient({"prod/api": {"SecretString": "{not-json}"}})
    monkeypatch.setattr(config, "_client", lambda region: client)

    with pytest.raises(SecretConfigError, match="invalid JSON"):
        config.load_secret_json("prod/api", "us-east-1")


def test_load_secret_json_rejects_non_object_json(monkeypatch):
    client = FakeSecretsClient({"prod/api": {"SecretString": json.dumps([])}})
    monkeypatch.setattr(config, "_client", lambda region: client)

    with pytest.raises(SecretConfigError, match="must be a JSON object"):
        config.load_secret_json("prod/api", "us-east-1")


def test_load_secret_json_rejects_missing_secret_string(monkeypatch):
    client = FakeSecretsClient({"prod/api": {"SecretBinary": b"abc"}})
    monkeypatch.setattr(config, "_client", lambda region: client)

    with pytest.raises(SecretConfigError, match="must contain SecretString"):
        config.load_secret_json("prod/api", "us-east-1")


def test_cache_returns_copy(monkeypatch):
    client = FakeSecretsClient({"prod/api": {"SecretString": json.dumps({"key": "original"})}})
    monkeypatch.setattr(config, "_client", lambda region: client)

    first = config.load_secret_json("prod/api", "us-east-1")
    first["key"] = "modified"
    second = config.load_secret_json("prod/api", "us-east-1")
    assert second["key"] == "original"


def test_load_stage_groups_requires_region_when_stage_set(monkeypatch):
    client = FakeSecretsClient({})
    monkeypatch.setattr(config, "_client", lambda region: client)

    with pytest.raises(SecretConfigError, match="AWS_REGION is required"):
        config.load_stage_groups(
            groups=["api"],
            environ={"SECRETS_STAGE": "prod"},
        )


def test_load_stage_groups_uses_explicit_stage_and_region(monkeypatch):
    client = FakeSecretsClient({"staging/api": {"SecretString": json.dumps({"KEY": "val"})}})
    monkeypatch.setattr(config, "_client", lambda region: client)

    result = config.load_stage_groups(
        groups=["api"],
        stage="staging",
        region="eu-west-1",
        environ={},
    )
    assert result == {"KEY": "val"}

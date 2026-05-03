from __future__ import annotations

import json

import pytest

from dokumen_aws_secrets import config
from dokumen_aws_secrets.config import SecretConfigError


class FakeSecretsClient:
    def __init__(self, payloads):
        self.payloads = payloads
        self.calls: list[str] = []

    def get_secret_value(self, *, SecretId: str):
        self.calls.append(SecretId)
        payload = self.payloads[SecretId]
        if isinstance(payload, Exception):
            raise payload
        return payload


@pytest.fixture(autouse=True)
def reset_cache():
    config._CACHE.clear()


def test_load_stage_groups_returns_empty_without_stage():
    result = config.load_stage_groups(groups=["api"], environ={"AWS_REGION": "us-east-1"})
    assert result == {}


def test_load_stage_groups_merges_in_order(monkeypatch):
    client = FakeSecretsClient(
        {
            "prod/api": {"SecretString": json.dumps({"API_KEY": "api", "SHARED": "api"})},
            "prod/runpod": {"SecretString": json.dumps({"RUNPOD_API_KEY": "runpod", "SHARED": "runpod"})},
        }
    )
    monkeypatch.setattr(config, "_client", lambda region: client)

    result = config.load_stage_groups(
        groups=["api", "runpod"],
        environ={"SECRETS_STAGE": "prod", "AWS_REGION": "us-east-1"},
    )

    assert result == {"API_KEY": "api", "RUNPOD_API_KEY": "runpod", "SHARED": "runpod"}
    assert client.calls == ["prod/api", "prod/runpod"]


def test_load_secret_json_uses_cache(monkeypatch):
    client = FakeSecretsClient({"prod/api": {"SecretString": json.dumps({"API_KEY": "one"})}})
    monkeypatch.setattr(config, "_client", lambda region: client)

    assert config.load_secret_json("prod/api", "us-east-1") == {"API_KEY": "one"}
    assert config.load_secret_json("prod/api", "us-east-1") == {"API_KEY": "one"}
    assert client.calls == ["prod/api"]


@pytest.mark.parametrize(
    "payload",
    [
        {"SecretString": "{not-json"},
        {"SecretString": "[]"},
        {"SecretBinary": b"abc"},
    ],
)
def test_load_secret_json_rejects_invalid_payloads(monkeypatch, payload):
    monkeypatch.setattr(config, "_client", lambda region: FakeSecretsClient({"prod/api": payload}))

    with pytest.raises(SecretConfigError):
        config.load_secret_json("prod/api", "us-east-1")

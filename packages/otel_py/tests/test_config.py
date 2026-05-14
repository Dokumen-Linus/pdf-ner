import os

import pytest

from otel_py.config import ObservabilityConfig, _env_flag


class TestEnvFlag:
    def test_default_when_unset(self):
        assert _env_flag("DOES_NOT_EXIST_XYZ", default=True) is True
        assert _env_flag("DOES_NOT_EXIST_XYZ", default=False) is False

    def test_true_values(self, monkeypatch):
        for val in ("1", "true", "TRUE", "yes", "YES", "on", "ON"):
            monkeypatch.setenv("TEST_FLAG", val)
            assert _env_flag("TEST_FLAG", False) is True

    def test_false_values(self, monkeypatch):
        for val in ("0", "false", "no", "off", "maybe"):
            monkeypatch.setenv("TEST_FLAG", val)
            assert _env_flag("TEST_FLAG", True) is False


class TestObservabilityConfig:
    def test_from_env_sets_defaults(self, monkeypatch):
        monkeypatch.delenv("LOG_JSON", raising=False)
        monkeypatch.delenv("METRICS_ENABLED", raising=False)
        monkeypatch.delenv("OBS_ENABLED", raising=False)

        cfg = ObservabilityConfig.from_env(
            service="svc", version="1.0", env="test", runtime="python"
        )
        assert cfg.service == "svc"
        assert cfg.version == "1.0"
        assert cfg.env == "test"
        assert cfg.runtime == "python"
        assert cfg.log_json is True
        assert cfg.metrics_enabled is True
        assert cfg.tracing_enabled is True
        assert cfg.otel_service_namespace == "dokumen"
        assert cfg.otel_exporter_otlp_endpoint is None
        assert cfg.deployment is None

    def test_from_env_reads_env_vars(self, monkeypatch):
        monkeypatch.setenv("LOG_JSON", "false")
        monkeypatch.setenv("METRICS_ENABLED", "false")
        monkeypatch.setenv("OBS_ENABLED", "false")
        monkeypatch.setenv("OTEL_SERVICE_NAMESPACE", "myapp")
        monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel:4318")
        monkeypatch.setenv("OTEL_EXPORTER_OTLP_HEADERS", "x-api-key=abc")
        monkeypatch.setenv("DEPLOYMENT", "canary")

        cfg = ObservabilityConfig.from_env(
            service="svc", version="1.0", env="prod", runtime="python"
        )
        assert cfg.log_json is False
        assert cfg.metrics_enabled is False
        assert cfg.tracing_enabled is False
        assert cfg.otel_service_namespace == "myapp"
        assert cfg.otel_exporter_otlp_endpoint == "http://otel:4318"
        assert cfg.otel_exporter_otlp_headers == "x-api-key=abc"
        assert cfg.deployment == "canary"

    def test_frozen_dataclass(self):
        cfg = ObservabilityConfig(service="s", version="v", env="e", runtime="r")
        with pytest.raises(AttributeError):
            cfg.service = "other"

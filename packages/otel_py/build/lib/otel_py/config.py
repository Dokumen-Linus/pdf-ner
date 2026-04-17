from dataclasses import dataclass
import os


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class ObservabilityConfig:
    service: str
    version: str
    env: str
    runtime: str
    log_json: bool = True
    metrics_enabled: bool = True
    tracing_enabled: bool = True
    otel_service_namespace: str = "dokumen"
    otel_exporter_otlp_endpoint: str | None = None
    otel_exporter_otlp_headers: str | None = None
    deployment: str | None = None

    @classmethod
    def from_env(
        cls,
        *,
        service: str,
        version: str,
        env: str,
        runtime: str,
    ) -> "ObservabilityConfig":
        return cls(
            service=service,
            version=version,
            env=env,
            runtime=runtime,
            log_json=_env_flag("LOG_JSON", True),
            metrics_enabled=_env_flag("METRICS_ENABLED", True),
            tracing_enabled=_env_flag("OBS_ENABLED", True),
            otel_service_namespace=os.getenv("OTEL_SERVICE_NAMESPACE", "dokumen"),
            otel_exporter_otlp_endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
            otel_exporter_otlp_headers=os.getenv("OTEL_EXPORTER_OTLP_HEADERS"),
            deployment=os.getenv("DEPLOYMENT"),
        )

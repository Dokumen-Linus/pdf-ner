import json
import logging
import socket
import sys
from typing import Any

from .config import ObservabilityConfig
from .context import get_context


class JsonLogFormatter(logging.Formatter):
    def __init__(self, config: ObservabilityConfig) -> None:
        super().__init__()
        self._config = config
        self._hostname = socket.gethostname()

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": self._config.service,
            "version": self._config.version,
            "env": self._config.env,
            "runtime": self._config.runtime,
            "hostname": self._hostname,
        }
        if self._config.deployment:
            payload["deployment"] = self._config.deployment
        payload.update(get_context())
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class PlainLogFormatter(logging.Formatter):
    def __init__(self, config: ObservabilityConfig) -> None:
        super().__init__("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
        self._config = config

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        context = get_context()
        if not context:
            return base
        extra = " ".join(f"{key}={value}" for key, value in sorted(context.items()))
        return f"{base} | {extra}"


def configure_logging(config: ObservabilityConfig) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter(config) if config.log_json else PlainLogFormatter(config))

    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

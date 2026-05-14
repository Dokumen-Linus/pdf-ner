import logging

from otel_py.config import ObservabilityConfig
from otel_py.context import bind_context
from otel_py.logging import JsonLogFormatter, PlainLogFormatter, configure_logging


class TestJsonLogFormatter:
    def test_format_includes_required_fields(self):
        cfg = ObservabilityConfig(service="svc", version="1.0", env="prod", runtime="python")
        fmt = JsonLogFormatter(cfg)
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="hello world",
            args=(),
            exc_info=None,
        )
        output = fmt.format(record)
        assert '"message": "hello world"' in output
        assert '"service": "svc"' in output
        assert '"version": "1.0"' in output
        assert '"env": "prod"' in output
        assert '"runtime": "python"' in output
        assert '"hostname"' in output
        assert '"logger": "test.logger"' in output
        assert '"level": "INFO"' in output

    def test_format_includes_deployment_when_set(self):
        cfg = ObservabilityConfig(
            service="svc",
            version="1.0",
            env="prod",
            runtime="python",
            deployment="canary",
        )
        fmt = JsonLogFormatter(cfg)
        record = logging.LogRecord("x", logging.INFO, "", 0, "msg", (), None)
        output = fmt.format(record)
        assert '"deployment": "canary"' in output

    def test_format_includes_context(self):
        cfg = ObservabilityConfig(service="svc", version="1.0", env="test", runtime="python")
        fmt = JsonLogFormatter(cfg)
        bind_context(trace_id="abc123")
        record = logging.LogRecord("x", logging.INFO, "", 0, "msg", (), None)
        output = fmt.format(record)
        assert '"trace_id": "abc123"' in output

    def test_format_includes_exc_info(self):
        cfg = ObservabilityConfig(service="svc", version="1.0", env="test", runtime="python")
        fmt = JsonLogFormatter(cfg)
        try:
            raise ValueError("test error")
        except ValueError:
            import sys

            exc_info = sys.exc_info()
            record = logging.LogRecord("x", logging.ERROR, "", 0, "msg", (), exc_info=exc_info)
        output = fmt.format(record)
        assert '"exc_info"' in output
        assert "ValueError" in output


class TestPlainLogFormatter:
    def test_format_basic(self):
        cfg = ObservabilityConfig(service="svc", version="1.0", env="test", runtime="python")
        fmt = PlainLogFormatter(cfg)
        record = logging.LogRecord("x", logging.WARNING, "", 0, "test msg", (), None)
        output = fmt.format(record)
        assert "WARNING" in output
        assert "test msg" in output

    def test_format_with_context(self):
        cfg = ObservabilityConfig(service="svc", version="1.0", env="test", runtime="python")
        fmt = PlainLogFormatter(cfg)
        bind_context(trace_id="abc")
        record = logging.LogRecord("x", logging.INFO, "", 0, "msg", (), None)
        output = fmt.format(record)
        assert "trace_id=abc" in output


class TestConfigureLogging:
    def test_configure_json_logging(self):
        cfg = ObservabilityConfig(
            service="svc", version="1.0", env="test", runtime="python", log_json=True
        )
        configure_logging(cfg)
        logger = logging.getLogger("test_json")
        logger.info("json log test")
        assert logger.level == logging.NOTSET

    def test_configure_plain_logging(self):
        cfg = ObservabilityConfig(
            service="svc", version="1.0", env="test", runtime="python", log_json=False
        )
        configure_logging(cfg)
        logger = logging.getLogger("test_plain")
        logger.warning("plain log test")
        assert logger.level == logging.NOTSET

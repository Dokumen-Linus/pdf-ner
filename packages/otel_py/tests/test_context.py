import pytest

from otel_py.context import bind_context, clear_context, get_context, get_context_value


class TestContext:
    def setup_method(self):
        clear_context()

    def test_initial_context_is_empty(self):
        assert get_context() == {}

    def test_bind_context_adds_values(self):
        bind_context(trace_id="abc", span_id="123")
        assert get_context() == {"trace_id": "abc", "span_id": "123"}

    def test_bind_context_overwrites(self):
        bind_context(trace_id="first")
        bind_context(trace_id="second")
        assert get_context() == {"trace_id": "second"}

    def test_bind_context_removes_none_value(self):
        bind_context(trace_id="abc")
        bind_context(trace_id=None)
        assert "trace_id" not in get_context()

    def test_bind_context_returns_updated(self):
        clear_context()
        result = bind_context(key="val")
        assert result == {"key": "val"}

    def test_clear_context_all(self):
        bind_context(a="1", b="2")
        clear_context()
        assert get_context() == {}

    def test_clear_context_specific_keys(self):
        bind_context(a="1", b="2", c="3")
        clear_context("a", "c")
        assert get_context() == {"b": "2"}

    def test_clear_context_nonexistent_key(self):
        clear_context()
        bind_context(a="1")
        clear_context("nonexistent")
        assert get_context() == {"a": "1"}

    def test_get_context_returns_copy(self):
        clear_context()
        bind_context(key="val")
        ctx = get_context()
        ctx["modified"] = "yes"
        assert get_context() == {"key": "val"}

    def test_get_context_value_returns_value(self):
        clear_context()
        bind_context(key="val")
        assert get_context_value("key") == "val"

    def test_get_context_value_missing(self):
        clear_context()
        assert get_context_value("nonexistent") is None

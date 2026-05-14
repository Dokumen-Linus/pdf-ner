from otel_py.context import get_context
from otel_py.tracing import extract_carrier, inject_carrier, start_span, trace_headers


class TestExtractCarrier:
    def test_extracts_trace_id_from_traceparent(self):
        result = extract_carrier({"traceparent": "00-abc123-def456-01"})
        assert result["trace_id"] == "abc123"
        assert result["span_id"] == "def456"

    def test_extracts_trace_id_from_x_trace_id(self):
        result = extract_carrier({"x-trace-id": "my-trace"})
        assert result["trace_id"] == "my-trace"

    def test_fallback_generates_new_ids(self):
        result = extract_carrier(None)
        assert len(result["trace_id"]) == 32
        assert len(result["span_id"]) == 16

    def test_empty_headers_generates_new_ids(self):
        result = extract_carrier({})
        assert len(result["trace_id"]) == 32

    def test_binds_context(self):
        extract_carrier({"traceparent": "00-aabb-ccdd-01"})
        ctx = get_context()
        assert ctx["trace_id"] == "aabb"
        assert ctx["span_id"] == "ccdd"

    def test_lowercases_carrier_keys(self):
        result = extract_carrier({"TraceParent": "00-abc-def-01", "X-Trace-Id": "custom"})
        assert result["trace_id"] == "abc"


class TestInjectCarrier:
    def test_injects_traceparent(self):
        result = inject_carrier()
        assert "traceparent" in result
        assert result["traceparent"].startswith("00-")

    def test_injects_x_trace_id(self):
        result = inject_carrier()
        assert "x-trace-id" in result

    def test_preserves_existing_headers(self):
        result = inject_carrier({"existing": "value"})
        assert result["existing"] == "value"

    def test_uses_existing_trace_id_from_context(self):
        extract_carrier({"traceparent": "00-feed-face-01"})
        result = inject_carrier()
        assert "feed" in result["traceparent"]


class TestTraceHeaders:
    def test_returns_trace_headers(self):
        headers = trace_headers()
        assert isinstance(headers, dict)
        assert "traceparent" in headers
        assert "x-trace-id" in headers


class TestStartSpan:
    def test_creates_span_and_returns_ids(self):
        with start_span("test-operation") as ids:
            assert "trace_id" in ids
            assert "span_id" in ids
            assert get_context()["span_name"] == "test-operation"

    def test_nested_spans_get_new_span_id(self):
        with start_span("outer") as outer_ids:
            with start_span("inner") as inner_ids:
                pass

        assert outer_ids["span_id"] != inner_ids["span_id"]

    def test_attributes_do_not_block(self):
        with start_span("attrs", attributes={"key": "val"}):
            pass

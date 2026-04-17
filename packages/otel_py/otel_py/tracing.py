from collections.abc import Iterator, Mapping, MutableMapping
from contextlib import contextmanager
import secrets

from .context import bind_context, get_context_value

try:
    from opentelemetry import trace as otel_trace
    from opentelemetry.propagate import extract as otel_extract
    from opentelemetry.propagate import inject as otel_inject
except Exception:  # pragma: no cover - optional dependency
    otel_trace = None
    otel_extract = None
    otel_inject = None


def _new_trace_id() -> str:
    return secrets.token_hex(16)


def _new_span_id() -> str:
    return secrets.token_hex(8)


def extract_carrier(headers: Mapping[str, str] | None) -> dict[str, str]:
    carrier = {key.lower(): value for key, value in (headers or {}).items()}
    if otel_extract is not None:  # pragma: no branch
        try:
            otel_extract(carrier)
        except Exception:
            pass

    traceparent = carrier.get("traceparent", "")
    trace_id = None
    span_id = None
    parts = traceparent.split("-")
    if len(parts) >= 4:
        trace_id = parts[1]
        span_id = parts[2]

    if trace_id is None:
        trace_id = carrier.get("x-trace-id") or _new_trace_id()
    if span_id is None:
        span_id = _new_span_id()

    bind_context(trace_id=trace_id, span_id=span_id)
    return {"trace_id": trace_id, "span_id": span_id}


def inject_carrier(carrier: MutableMapping[str, str] | None = None) -> dict[str, str]:
    target: dict[str, str] = dict(carrier or {})
    trace_id = get_context_value("trace_id") or _new_trace_id()
    span_id = get_context_value("span_id") or _new_span_id()
    target["traceparent"] = f"00-{trace_id}-{span_id}-01"
    target.setdefault("x-trace-id", trace_id)

    if otel_inject is not None:  # pragma: no branch
        try:
            otel_inject(target)
        except Exception:
            pass

    bind_context(trace_id=trace_id, span_id=span_id)
    return target


def trace_headers() -> dict[str, str]:
    return inject_carrier({})


@contextmanager
def start_span(
    name: str, attributes: Mapping[str, object] | None = None
) -> Iterator[dict[str, str]]:
    trace_id = get_context_value("trace_id") or _new_trace_id()
    span_id = _new_span_id()
    bind_context(trace_id=trace_id, span_id=span_id, span_name=name)

    if otel_trace is not None:  # pragma: no branch
        tracer = otel_trace.get_tracer("otel_py")
        with tracer.start_as_current_span(name) as span:
            if attributes:
                for key, value in attributes.items():
                    span.set_attribute(key, value)
            yield {"trace_id": trace_id, "span_id": span_id}
            return

    yield {"trace_id": trace_id, "span_id": span_id}

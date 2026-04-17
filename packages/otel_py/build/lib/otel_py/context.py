from contextvars import ContextVar

_context: ContextVar[dict[str, str]] = ContextVar("otel_py_context", default={})


def bind_context(**values: object) -> dict[str, str]:
    current = dict(_context.get())
    for key, value in values.items():
        if value is None:
            current.pop(key, None)
        else:
            current[key] = str(value)
    _context.set(current)
    return current


def clear_context(*keys: str) -> None:
    if not keys:
        _context.set({})
        return

    current = dict(_context.get())
    for key in keys:
        current.pop(key, None)
    _context.set(current)


def get_context() -> dict[str, str]:
    return dict(_context.get())


def get_context_value(key: str) -> str | None:
    return _context.get().get(key)

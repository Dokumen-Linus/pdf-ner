from collections import defaultdict
from threading import Lock


Labels = dict[str, str]


def _freeze_labels(labels: Labels | None) -> tuple[tuple[str, str], ...]:
    if not labels:
        return ()
    return tuple(sorted((str(key), str(value)) for key, value in labels.items()))


class MetricsRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._counters: defaultdict[str, defaultdict[tuple[tuple[str, str], ...], float]] = defaultdict(
            lambda: defaultdict(float)
        )
        self._gauges: defaultdict[str, dict[tuple[tuple[str, str], ...], float]] = defaultdict(dict)
        self._histograms: defaultdict[
            str, defaultdict[tuple[tuple[str, str], ...], dict[str, float]]
        ] = defaultdict(lambda: defaultdict(lambda: {"count": 0.0, "sum": 0.0}))

    def increment(self, name: str, value: float = 1.0, labels: Labels | None = None) -> None:
        key = _freeze_labels(labels)
        with self._lock:
            self._counters[name][key] += value

    def set_gauge(self, name: str, value: float, labels: Labels | None = None) -> None:
        key = _freeze_labels(labels)
        with self._lock:
            self._gauges[name][key] = value

    def observe(self, name: str, value: float, labels: Labels | None = None) -> None:
        key = _freeze_labels(labels)
        with self._lock:
            bucket = self._histograms[name][key]
            bucket["count"] += 1.0
            bucket["sum"] += value

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            return {
                "counters": {
                    name: {dict(labels).__repr__(): value for labels, value in values.items()}
                    for name, values in self._counters.items()
                },
                "gauges": {
                    name: {dict(labels).__repr__(): value for labels, value in values.items()}
                    for name, values in self._gauges.items()
                },
                "histograms": {
                    name: {dict(labels).__repr__(): dict(value) for labels, value in values.items()}
                    for name, values in self._histograms.items()
                },
            }

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()
            self._gauges.clear()
            self._histograms.clear()

    def render_prometheus(self) -> str:
        lines: list[str] = []
        with self._lock:
            for name, values in sorted(self._counters.items()):
                lines.append(f"# TYPE {name} counter")
                for labels, value in values.items():
                    lines.append(f"{name}{_format_labels(labels)} {value}")
            for name, values in sorted(self._gauges.items()):
                lines.append(f"# TYPE {name} gauge")
                for labels, value in values.items():
                    lines.append(f"{name}{_format_labels(labels)} {value}")
            for name, values in sorted(self._histograms.items()):
                lines.append(f"# TYPE {name} summary")
                for labels, value in values.items():
                    lines.append(f"{name}_count{_format_labels(labels)} {value['count']}")
                    lines.append(f"{name}_sum{_format_labels(labels)} {value['sum']}")
        return "\n".join(lines) + ("\n" if lines else "")


def _format_labels(labels: tuple[tuple[str, str], ...]) -> str:
    if not labels:
        return ""
    chunks = [f'{key}="{value}"' for key, value in labels]
    return "{" + ",".join(chunks) + "}"


_registry = MetricsRegistry()


def get_metrics_registry() -> MetricsRegistry:
    return _registry

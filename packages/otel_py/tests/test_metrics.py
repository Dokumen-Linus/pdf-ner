from threading import Thread

from otel_py.metrics import MetricsRegistry


class TestMetricsRegistry:
    def test_increment_creates_counter(self):
        registry = MetricsRegistry()
        registry.increment("requests_total")
        snap = registry.snapshot()
        assert "requests_total" in snap["counters"]

    def test_increment_adds_value(self):
        registry = MetricsRegistry()
        registry.increment("requests_total", value=5.0)
        snap = registry.snapshot()
        val = next(iter(snap["counters"]["requests_total"].values()))
        assert val == 5.0

    def test_increment_with_labels(self):
        registry = MetricsRegistry()
        registry.increment("requests_total", labels={"method": "GET"})
        registry.increment("requests_total", labels={"method": "GET"})
        snap = registry.snapshot()
        val = next(iter(snap["counters"]["requests_total"].values()))
        assert val == 2.0

    def test_set_gauge(self):
        registry = MetricsRegistry()
        registry.set_gauge("queue_depth", 42.0)
        snap = registry.snapshot()
        val = next(iter(snap["gauges"]["queue_depth"].values()))
        assert val == 42.0

    def test_set_gauge_overwrites(self):
        registry = MetricsRegistry()
        registry.set_gauge("queue_depth", 1.0)
        registry.set_gauge("queue_depth", 2.0)
        snap = registry.snapshot()
        val = next(iter(snap["gauges"]["queue_depth"].values()))
        assert val == 2.0

    def test_observe_histogram(self):
        registry = MetricsRegistry()
        registry.observe("latency", 0.5)
        registry.observe("latency", 1.5)
        snap = registry.snapshot()
        bucket = next(iter(snap["histograms"]["latency"].values()))
        assert bucket["count"] == 2.0
        assert bucket["sum"] == 2.0

    def test_reset_clears_all(self):
        registry = MetricsRegistry()
        registry.increment("requests_total")
        registry.set_gauge("depth", 1.0)
        registry.observe("latency", 0.5)
        registry.reset()
        snap = registry.snapshot()
        assert snap["counters"] == {}
        assert snap["gauges"] == {}
        assert snap["histograms"] == {}

    def test_render_prometheus_empty(self):
        registry = MetricsRegistry()
        assert registry.render_prometheus() == ""

    def test_render_prometheus_counter(self):
        registry = MetricsRegistry()
        registry.increment("requests_total", labels={"method": "GET"})
        output = registry.render_prometheus()
        assert "# TYPE requests_total counter" in output
        assert 'requests_total{method="GET"} 1.0' in output

    def test_render_prometheus_gauge(self):
        registry = MetricsRegistry()
        registry.set_gauge("depth", 3.0, labels={"pool": "main"})
        output = registry.render_prometheus()
        assert "# TYPE depth gauge" in output
        assert 'depth{pool="main"} 3.0' in output

    def test_render_prometheus_histogram(self):
        registry = MetricsRegistry()
        registry.observe("latency", 2.0)
        output = registry.render_prometheus()
        assert "# TYPE latency summary" in output
        assert "latency_count" in output
        assert "latency_sum" in output

    def test_render_prometheus_no_labels(self):
        registry = MetricsRegistry()
        registry.increment("simple")
        output = registry.render_prometheus()
        assert "simple 1.0" in output

    def test_thread_safety(self):
        registry = MetricsRegistry()
        errors = []

        def increment_many():
            for _ in range(1000):
                try:
                    registry.increment("counter", labels={"thread": "test"})
                except Exception as e:
                    errors.append(e)

        threads = [Thread(target=increment_many) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        snap = registry.snapshot()
        val = next(iter(snap["counters"]["counter"].values()))
        assert val == 4000.0

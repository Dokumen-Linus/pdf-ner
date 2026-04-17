from unittest.mock import AsyncMock

import pytest

from app.core.telemetry import get_metrics_registry
from app.shared.infrastructure import redis as redis_module


@pytest.fixture(autouse=True)
def reset_metrics():
    get_metrics_registry().reset()


@pytest.mark.anyio
async def test_redis_metrics_use_key_prefix_labels(monkeypatch):
    client = AsyncMock()
    client.setex = AsyncMock(return_value=True)
    client.get = AsyncMock(return_value="queued")
    client.delete = AsyncMock(return_value=1)
    monkeypatch.setattr(redis_module, "get_redis", AsyncMock(return_value=client))

    await redis_module.set_job_status("123e4567-e89b-12d3-a456-426614174000", "queued")
    await redis_module.get_job_status("123e4567-e89b-12d3-a456-426614174000")
    await redis_module.delete_cache("job:123e4567-e89b-12d3-a456-426614174000:status")

    snapshot = get_metrics_registry().snapshot()
    counters = snapshot["counters"]["dokumen_redis_operations_total"]

    assert any("'key_prefix': 'job'" in labels for labels in counters)
    assert not any("123e4567-e89b-12d3-a456-426614174000" in labels for labels in counters)

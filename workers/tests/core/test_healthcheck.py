from unittest.mock import AsyncMock, MagicMock

import pytest

from app import healthcheck


@pytest.mark.anyio
async def test_build_health_reports_redis_and_celery_ready(monkeypatch):
    monkeypatch.setattr(healthcheck, "check_redis", AsyncMock(return_value="ready"))
    monkeypatch.setattr(healthcheck, "check_celery", MagicMock(return_value="ready"))

    result = await healthcheck.build_health(include_database=False)

    assert result == {"status": "ready", "checks": {"redis": "ready", "celery": "ready"}}


@pytest.mark.anyio
async def test_build_health_reports_redis_failure(monkeypatch):
    monkeypatch.setattr(healthcheck, "check_redis", AsyncMock(return_value="unready"))
    monkeypatch.setattr(healthcheck, "check_celery", MagicMock(return_value="ready"))

    result = await healthcheck.build_health(include_database=False)

    assert result["status"] == "unready"
    assert result["checks"]["redis"] == "unready"


@pytest.mark.anyio
async def test_build_health_reports_celery_failure(monkeypatch):
    monkeypatch.setattr(healthcheck, "check_redis", AsyncMock(return_value="ready"))
    monkeypatch.setattr(healthcheck, "check_celery", MagicMock(return_value="unready"))

    result = await healthcheck.build_health(include_database=False)

    assert result["status"] == "unready"
    assert result["checks"]["celery"] == "unready"


@pytest.mark.anyio
async def test_build_health_includes_database_details(monkeypatch):
    monkeypatch.setattr(healthcheck, "check_redis", AsyncMock(return_value="ready"))
    monkeypatch.setattr(healthcheck, "check_celery", MagicMock(return_value="ready"))
    monkeypatch.setattr(
        healthcheck,
        "check_database",
        AsyncMock(return_value={"table:workers.pdfs": "ready"}),
    )

    result = await healthcheck.build_health(include_database=True)

    assert result["status"] == "ready"
    assert result["checks"]["table:workers.pdfs"] == "ready"


def test_main_container_exits_zero_when_healthy(monkeypatch):
    monkeypatch.setattr(
        healthcheck,
        "build_health",
        AsyncMock(return_value={"status": "ready", "checks": {"redis": "ready"}}),
    )
    monkeypatch.setattr("sys.argv", ["healthcheck", "--container"])

    assert healthcheck.main() == 0


def test_main_container_exits_nonzero_when_unhealthy(monkeypatch, capsys):
    monkeypatch.setattr(
        healthcheck,
        "build_health",
        AsyncMock(return_value={"status": "unready", "checks": {"redis": "unready"}}),
    )
    monkeypatch.setattr("sys.argv", ["healthcheck", "--container"])

    assert healthcheck.main() == 1
    assert "redis" in capsys.readouterr().out

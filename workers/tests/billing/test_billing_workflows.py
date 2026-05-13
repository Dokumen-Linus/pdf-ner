from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from app.domains.billing.application import workflows
from app.domains.billing.infrastructure import repository


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeConn:
    def __init__(self):
        self.executed = []

    def transaction(self):
        return _Transaction()

    async def execute(self, sql, *args):
        self.executed.append((sql, args))


@pytest.mark.anyio
async def test_individual_charge_uses_10_dollar_base(monkeypatch):
    captured = {}
    period_start = datetime(2026, 1, 1, tzinfo=UTC)
    period_end = datetime(2026, 2, 1, tzinfo=UTC)
    row = {
        "id": UUID("11111111-1111-1111-1111-111111111111"),
        "billing_started_at": period_start,
        "last_payment_at": None,
        "next_payment_at": period_end,
        "billing_failure_count": 0,
        "stripe_customer_id": "cus_test",
        "stripe_payment_method_id": "pm_test",
    }

    async def sum_individual_usage(*args, **kwargs):
        return {"usage_cost_usd": Decimal("0"), "llm_usage_count": 0}

    async def create_charge_attempt(*args, **kwargs):
        captured.update(kwargs)
        return {"id": uuid4(), "total_amount_cents": 0, "status": "pending"}

    async def mark_charge_success(*args, **kwargs):
        captured["success"] = kwargs

    monkeypatch.setattr(workflows.repo, "sum_individual_usage", sum_individual_usage)
    monkeypatch.setattr(workflows.repo, "create_charge_attempt", create_charge_attempt)
    monkeypatch.setattr(workflows.repo, "mark_charge_success", mark_charge_success)

    result = await workflows._charge_account(object(), account_type="individual", row=row)

    assert result == "succeeded"
    assert captured["base_amount_cents"] == 1000
    assert captured["period_end"] == period_end
    assert captured["success"]["period_end"] == period_end


@pytest.mark.anyio
async def test_organization_charge_uses_10_dollars_per_user(monkeypatch):
    captured = {}
    period_start = datetime(2026, 1, 1, tzinfo=UTC)
    period_end = datetime(2026, 2, 1, tzinfo=UTC)
    row = {
        "id": "org_123",
        "n_users": 4,
        "billing_started_at": period_start,
        "last_payment_at": None,
        "next_payment_at": period_end,
        "billing_failure_count": 0,
        "stripe_customer_id": "cus_test",
        "stripe_payment_method_id": "pm_test",
    }

    async def sum_organization_usage(*args, **kwargs):
        return {"usage_cost_usd": Decimal("0"), "llm_usage_count": 0}

    async def create_charge_attempt(*args, **kwargs):
        captured.update(kwargs)
        return {"id": uuid4(), "total_amount_cents": 0, "status": "pending"}

    async def mark_charge_success(*args, **kwargs):
        captured["success"] = kwargs

    monkeypatch.setattr(workflows.repo, "sum_organization_usage", sum_organization_usage)
    monkeypatch.setattr(workflows.repo, "create_charge_attempt", create_charge_attempt)
    monkeypatch.setattr(workflows.repo, "mark_charge_success", mark_charge_success)

    result = await workflows._charge_account(object(), account_type="organization", row=row)

    assert result == "succeeded"
    assert captured["base_amount_cents"] == 4000
    assert captured["period_end"] == period_end
    assert captured["success"]["period_end"] == period_end


@pytest.mark.anyio
async def test_success_advances_monthly_anchor_from_prior_anchor():
    conn = _FakeConn()
    period_end = datetime(2026, 2, 1, tzinfo=UTC)

    await repository.mark_charge_success(
        conn,
        attempt_id=1,
        account_type="individual",
        account_id="11111111-1111-1111-1111-111111111111",
        period_end=period_end,
        payment_intent_id="pi_test",
    )

    account_update_sql, account_update_args = conn.executed[1]
    assert "next_payment_at = $2::timestamptz + interval '1 month'" in account_update_sql
    assert account_update_args[1] == period_end


@pytest.mark.anyio
async def test_failed_charge_uses_retry_after_without_moving_monthly_anchor():
    conn = _FakeConn()
    retry_after = datetime(2026, 2, 2, tzinfo=UTC)

    await repository.mark_charge_failure(
        conn,
        attempt_id=1,
        account_type="organization",
        account_id="org_123",
        error_message="card declined",
        retry_after=retry_after,
    )

    attempt_update_sql, attempt_update_args = conn.executed[0]
    account_update_sql, account_update_args = conn.executed[1]
    assert "retry_after = $3" in attempt_update_sql
    assert attempt_update_args[2] == retry_after
    assert "next_payment_at" not in account_update_sql
    assert account_update_args == ("org_123",)

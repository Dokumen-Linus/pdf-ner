from types import SimpleNamespace

import pytest

from app.domains.uat_billing.application import workflows


class _Acquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Conn:
    def transaction(self):
        return _Transaction()


class _Pool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return _Acquire(self.conn)


def _set_stripe_key(monkeypatch, value: str):
    monkeypatch.setattr(workflows, "settings", SimpleNamespace(STRIPE_SECRET_KEY=value))


@pytest.mark.anyio
async def test_direct_payment_uses_saved_customer_payment_method_metadata_and_idempotency(
    monkeypatch,
):
    _set_stripe_key(monkeypatch, "sk_test_dummy")
    captured = {}

    async def fake_get_pool():
        return _Pool(_Conn())

    async def fake_fetch_account(*args, **kwargs):
        captured["fetch"] = kwargs
        return {
            "stripe_customer_id": "cus_test",
            "stripe_payment_method_id": "pm_test",
        }

    class FakePaymentIntents:
        def create(self, payload, options):
            captured["payload"] = payload
            captured["options"] = options
            return {"id": "pi_test"}

    fake_stripe = SimpleNamespace(v1=SimpleNamespace(payment_intents=FakePaymentIntents()))

    monkeypatch.setattr(workflows, "get_pool", fake_get_pool)
    monkeypatch.setattr(workflows.repository, "fetch_billing_account", fake_fetch_account)
    monkeypatch.setattr(workflows, "_get_stripe_client", lambda: fake_stripe)

    result = await workflows.create_direct_payment(
        account_type="individual",
        account_id="user-1",
        amount_cents=123,
    )

    assert result == {
        "payment_intent_id": "pi_test",
        "amount_cents": 123,
        "account_type": "individual",
        "account_id": "user-1",
    }
    assert captured["payload"]["customer"] == "cus_test"
    assert captured["payload"]["payment_method"] == "pm_test"
    assert captured["payload"]["confirm"] is True
    assert captured["payload"]["off_session"] is True
    assert captured["payload"]["metadata"] == {
        "source": "uat_billing",
        "action": "direct_payment",
        "account_type": "individual",
        "account_id": "user-1",
    }
    assert captured["options"]["idempotency_key"] == "uat_direct:individual:user-1:123"


@pytest.mark.anyio
async def test_direct_payment_does_not_create_billing_attempts_or_advance_anchors(monkeypatch):
    _set_stripe_key(monkeypatch, "sk_test_dummy")
    called = {"charge": False}

    async def fake_get_pool():
        return _Pool(_Conn())

    async def fake_fetch_account(*args, **kwargs):
        return {
            "stripe_customer_id": "cus_test",
            "stripe_payment_method_id": "pm_test",
        }

    class FakePaymentIntents:
        def create(self, payload, options):
            return {"id": "pi_test"}

    async def fail_charge_account(*args, **kwargs):
        called["charge"] = True
        raise AssertionError("direct payment should not call billing charge workflow")

    monkeypatch.setattr(workflows, "get_pool", fake_get_pool)
    monkeypatch.setattr(workflows.repository, "fetch_billing_account", fake_fetch_account)
    monkeypatch.setattr(
        workflows,
        "_get_stripe_client",
        lambda: SimpleNamespace(v1=SimpleNamespace(payment_intents=FakePaymentIntents())),
    )
    monkeypatch.setattr(workflows.billing_workflows, "charge_account_with_row", fail_charge_account)

    await workflows.create_direct_payment(
        account_type="organization",
        account_id="org-1",
        amount_cents=100,
    )

    assert called["charge"] is False


@pytest.mark.anyio
async def test_current_cycle_delegates_to_billing_charge_workflow(monkeypatch):
    _set_stripe_key(monkeypatch, "sk_test_dummy")
    captured = {}
    conn = _Conn()

    async def fake_get_pool():
        return _Pool(conn)

    async def fake_fetch_account(*args, **kwargs):
        return {"id": "user-1"}

    async def fake_charge_account(conn_arg, *, account_type, row):
        captured.update({"conn": conn_arg, "account_type": account_type, "row": row})
        return "succeeded"

    monkeypatch.setattr(workflows, "get_pool", fake_get_pool)
    monkeypatch.setattr(workflows.repository, "fetch_billing_account", fake_fetch_account)
    monkeypatch.setattr(workflows.billing_workflows, "charge_account_with_row", fake_charge_account)

    result = await workflows.charge_account(account_type="individual", account_id="user-1")

    assert result == {"status": "succeeded", "account_type": "individual", "account_id": "user-1"}
    assert captured == {
        "conn": conn,
        "account_type": "individual",
        "row": {"id": "user-1"},
    }


@pytest.mark.anyio
async def test_due_account_sweep_delegates_to_existing_billing_sweep(monkeypatch):
    _set_stripe_key(monkeypatch, "sk_test_dummy")
    captured = {}

    async def fake_charge_due_accounts(*, limit):
        captured["limit"] = limit
        return {"succeeded": 2, "failed": 1}

    monkeypatch.setattr(
        workflows.billing_workflows, "charge_due_accounts", fake_charge_due_accounts
    )

    result = await workflows.charge_due_accounts(limit=30)

    assert result == {"succeeded": 2, "failed": 1}
    assert captured == {"limit": 30}


@pytest.mark.anyio
async def test_live_mode_key_is_rejected_before_side_effects(monkeypatch):
    _set_stripe_key(monkeypatch, "sk_live_dummy")
    called = False

    async def fake_get_pool():
        nonlocal called
        called = True
        raise AssertionError("DB should not be touched")

    monkeypatch.setattr(workflows, "get_pool", fake_get_pool)

    with pytest.raises(RuntimeError, match="Stripe test secret key"):
        await workflows.create_direct_payment(
            account_type="individual",
            account_id="user-1",
            amount_cents=100,
        )

    assert called is False

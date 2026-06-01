import json

import pytest

from app.domains.uat_worker_dispatch import events


class TestUatWorkerDispatchRoutes:
    @pytest.mark.anyio
    async def test_direct_payment_dispatches_task_and_stores_metadata(
        self,
        async_client,
        mock_redis,
        monkeypatch,
    ):
        monkeypatch.setattr(events, "dispatch_direct_payment", lambda **kwargs: "task-direct")

        response = await async_client.post(
            "/api/v1/uat-worker-dispatch/billing/direct-payment",
            json={
                "account_type": "individual",
                "account_id": "user-1",
                "amount_cents": 123,
            },
        )

        assert response.status_code == 200
        assert response.json() == {"task_id": "task-direct"}
        key, value = mock_redis.set.call_args.args
        assert key == "uat-worker-dispatch:task:task-direct"
        assert json.loads(value) == {
            "action": "direct_payment",
            "account_type": "individual",
            "account_id": "user-1",
            "amount_cents": 123,
        }
        assert mock_redis.set.call_args.kwargs == {"ex": 3600}

    @pytest.mark.anyio
    async def test_rejects_direct_payment_amount_out_of_bounds(self, async_client):
        response = await async_client.post(
            "/api/v1/uat-worker-dispatch/billing/direct-payment",
            json={
                "account_type": "individual",
                "account_id": "user-1",
                "amount_cents": 49,
            },
        )

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_current_cycle_dispatches_expected_task(self, async_client, monkeypatch):
        captured = {}

        def fake_dispatch(**kwargs):
            captured.update(kwargs)
            return "task-cycle"

        monkeypatch.setattr(events, "dispatch_current_cycle", fake_dispatch)

        response = await async_client.post(
            "/api/v1/uat-worker-dispatch/billing/current-cycle",
            json={"account_type": "organization", "account_id": "org-1"},
        )

        assert response.status_code == 200
        assert response.json() == {"task_id": "task-cycle"}
        assert captured == {"account_type": "organization", "account_id": "org-1"}

    @pytest.mark.anyio
    async def test_due_accounts_dispatches_with_limit(self, async_client, monkeypatch):
        captured = {}

        def fake_dispatch(**kwargs):
            captured.update(kwargs)
            return "task-sweep"

        monkeypatch.setattr(events, "dispatch_due_accounts", fake_dispatch)

        response = await async_client.post(
            "/api/v1/uat-worker-dispatch/billing/due-accounts",
            json={"limit": 25},
        )

        assert response.status_code == 200
        assert response.json() == {"task_id": "task-sweep"}
        assert captured == {"limit": 25}

    @pytest.mark.anyio
    async def test_rejects_due_account_limit_out_of_bounds(self, async_client):
        response = await async_client.post(
            "/api/v1/uat-worker-dispatch/billing/due-accounts",
            json={"limit": 501},
        )

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_status_returns_celery_state_plus_metadata(
        self,
        async_client,
        mock_redis,
        monkeypatch,
    ):
        mock_redis.get.return_value = json.dumps({"action": "due_accounts", "limit": 10}).encode()
        monkeypatch.setattr(
            events,
            "get_task_status",
            lambda task_id: {"task_id": task_id, "status": "SUCCESS", "result": {"ok": True}},
        )

        response = await async_client.get("/api/v1/uat-worker-dispatch/tasks/task-1/status")

        assert response.status_code == 200
        assert response.json() == {
            "task_id": "task-1",
            "status": "SUCCESS",
            "result": {"ok": True},
            "metadata": {"action": "due_accounts", "limit": 10},
        }


class TestUatWorkerDispatchEvents:
    def test_dispatch_direct_payment_sends_expected_celery_task(self, monkeypatch):
        calls = []

        class FakeResult:
            id = "task-direct"

        monkeypatch.setattr(events, "celery_message_headers", lambda: {"request-id": "test"})
        monkeypatch.setattr(
            events.celery_client,
            "send_task",
            lambda *args, **kwargs: calls.append((args, kwargs)) or FakeResult(),
        )

        task_id = events.dispatch_direct_payment(
            account_type="individual",
            account_id="user-1",
            amount_cents=100,
        )

        assert task_id == "task-direct"
        assert calls == [
            (
                ("uat_billing.create_direct_payment",),
                {
                    "args": ["individual", "user-1", 100],
                    "headers": {"request-id": "test"},
                },
            )
        ]

    def test_dispatch_current_cycle_sends_expected_celery_task(self, monkeypatch):
        calls = []

        class FakeResult:
            id = "task-cycle"

        monkeypatch.setattr(events, "celery_message_headers", lambda: {"request-id": "test"})
        monkeypatch.setattr(
            events.celery_client,
            "send_task",
            lambda *args, **kwargs: calls.append((args, kwargs)) or FakeResult(),
        )

        task_id = events.dispatch_current_cycle(account_type="organization", account_id="org-1")

        assert task_id == "task-cycle"
        assert calls[0] == (
            ("uat_billing.charge_account",),
            {"args": ["organization", "org-1"], "headers": {"request-id": "test"}},
        )

    def test_dispatch_due_accounts_sends_expected_celery_task(self, monkeypatch):
        calls = []

        class FakeResult:
            id = "task-sweep"

        monkeypatch.setattr(events, "celery_message_headers", lambda: {"request-id": "test"})
        monkeypatch.setattr(
            events.celery_client,
            "send_task",
            lambda *args, **kwargs: calls.append((args, kwargs)) or FakeResult(),
        )

        task_id = events.dispatch_due_accounts(limit=20)

        assert task_id == "task-sweep"
        assert calls[0] == (
            ("uat_billing.charge_due_accounts",),
            {"kwargs": {"limit": 20}, "headers": {"request-id": "test"}},
        )

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
import logging
from typing import Any

from app.core.config import settings
from app.shared.infrastructure.db import get_pool

from ..infrastructure import repository as repo

logger = logging.getLogger(__name__)


def _get_stripe_client():
    import stripe

    return stripe.StripeClient(api_key=settings.STRIPE_SECRET_KEY)


def _period_start(row: Any):
    return row["last_payment_at"] or row["billing_started_at"]


def _retry_after(failure_count: int, now):
    hours = min(24 * 7, 2 ** max(failure_count, 0))
    return now + timedelta(hours=hours)


async def _charge_account(conn, *, account_type: str, row: Any) -> str:
    account_id = str(row["id"])
    period_start = _period_start(row)
    period_end = row["next_payment_at"]
    if account_type == "individual":
        usage = await repo.sum_individual_usage(
            conn,
            user_id=row["id"],
            period_start=period_start,
            period_end=period_end,
        )
        base_amount_cents = repo.BASE_PRICE_CENTS
    else:
        usage = await repo.sum_organization_usage(
            conn,
            organization_id=account_id,
            period_start=period_start,
            period_end=period_end,
        )
        base_amount_cents = repo.BASE_PRICE_CENTS * int(row["n_users"])

    usage_cost_usd = Decimal(str(usage["usage_cost_usd"]))
    idempotency_key = (
        f"billing:{account_type}:{account_id}:{period_start.isoformat()}:{period_end.isoformat()}"
    )
    attempt = await repo.create_charge_attempt(
        conn,
        account_type=account_type,
        account_id=account_id,
        period_start=period_start,
        period_end=period_end,
        base_amount_cents=base_amount_cents,
        usage_cost_usd=usage_cost_usd,
        llm_usage_count=usage["llm_usage_count"],
        stripe_customer_id=row["stripe_customer_id"],
        stripe_payment_method_id=row["stripe_payment_method_id"],
        idempotency_key=idempotency_key,
    )
    if attempt["status"] == "succeeded":
        return "succeeded"
    if attempt["total_amount_cents"] <= 0:
        await repo.mark_charge_success(
            conn,
            attempt_id=attempt["id"],
            account_type=account_type,
            account_id=account_id,
            period_end=period_end,
            payment_intent_id=f"zero_due_{attempt['id']}",
        )
        return "succeeded"

    stripe_client = _get_stripe_client()
    try:
        intent = stripe_client.v1.payment_intents.create(
            {
                "amount": attempt["total_amount_cents"],
                "currency": "usd",
                "customer": row["stripe_customer_id"],
                "payment_method": row["stripe_payment_method_id"],
                "confirm": True,
                "off_session": True,
                "metadata": {
                    "account_type": account_type,
                    "account_id": account_id,
                    "billing_charge_attempt_id": str(attempt["id"]),
                },
            },
            {"idempotency_key": idempotency_key},
        )
        await repo.mark_charge_success(
            conn,
            attempt_id=attempt["id"],
            account_type=account_type,
            account_id=account_id,
            period_end=period_end,
            payment_intent_id=intent["id"],
        )
        return "succeeded"
    except Exception as exc:
        retry_after = _retry_after(int(row["billing_failure_count"]), datetime.now(UTC))
        await repo.mark_charge_failure(
            conn,
            attempt_id=attempt["id"],
            account_type=account_type,
            account_id=account_id,
            error_message=str(exc),
            retry_after=retry_after,
        )
        logger.exception("Billing charge failed for %s %s", account_type, account_id)
        return "failed"


async def charge_due_accounts(*, limit: int = 100) -> dict[str, int]:
    pool = await get_pool()
    succeeded = 0
    failed = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            individuals = await repo.fetch_due_individuals(conn, limit=limit)
            organizations = await repo.fetch_due_organizations(conn, limit=limit)

            for row in individuals:
                status = await _charge_account(conn, account_type="individual", row=row)
                succeeded += int(status == "succeeded")
                failed += int(status == "failed")
            for row in organizations:
                status = await _charge_account(conn, account_type="organization", row=row)
                succeeded += int(status == "succeeded")
                failed += int(status == "failed")

    return {"succeeded": succeeded, "failed": failed}

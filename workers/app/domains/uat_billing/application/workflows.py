from __future__ import annotations

from app.core.config import settings
from app.domains.billing.application import workflows as billing_workflows
from app.shared.infrastructure.db import get_pool

from ..infrastructure import repository


def _require_test_stripe_key() -> None:
    if not settings.STRIPE_SECRET_KEY.startswith("sk_test_"):
        raise RuntimeError("UAT billing tasks require a Stripe test secret key")


def _get_stripe_client():
    import stripe

    return stripe.StripeClient(api_key=settings.STRIPE_SECRET_KEY)


async def create_direct_payment(
    *,
    account_type: str,
    account_id: str,
    amount_cents: int,
) -> dict[str, str | int]:
    _require_test_stripe_key()
    if amount_cents < 50 or amount_cents > 50000:
        raise ValueError("amount_cents must be between 50 and 50000")

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await repository.fetch_billing_account(
            conn,
            account_type=account_type,
            account_id=account_id,
        )
    if row is None:
        raise ValueError("Billing account with saved Stripe payment method was not found")

    idempotency_key = f"uat_direct:{account_type}:{account_id}:{amount_cents}"
    intent = _get_stripe_client().v1.payment_intents.create(
        {
            "amount": amount_cents,
            "currency": "usd",
            "customer": row["stripe_customer_id"],
            "payment_method": row["stripe_payment_method_id"],
            "confirm": True,
            "off_session": True,
            "metadata": {
                "source": "uat_billing",
                "action": "direct_payment",
                "account_type": account_type,
                "account_id": account_id,
            },
        },
        {"idempotency_key": idempotency_key},
    )
    return {
        "payment_intent_id": intent["id"],
        "amount_cents": amount_cents,
        "account_type": account_type,
        "account_id": account_id,
    }


async def charge_account(*, account_type: str, account_id: str) -> dict[str, str]:
    _require_test_stripe_key()
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await repository.fetch_billing_account(
                conn,
                account_type=account_type,
                account_id=account_id,
            )
            if row is None:
                raise ValueError("Billing account with saved Stripe payment method was not found")
            status = await billing_workflows.charge_account_with_row(
                conn,
                account_type=account_type,
                row=row,
            )

    return {"status": status, "account_type": account_type, "account_id": account_id}


async def charge_due_accounts(*, limit: int = 100) -> dict[str, int]:
    _require_test_stripe_key()
    if limit < 1 or limit > 500:
        raise ValueError("limit must be between 1 and 500")
    return await billing_workflows.charge_due_accounts(limit=limit)

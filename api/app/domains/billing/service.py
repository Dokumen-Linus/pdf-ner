from decimal import Decimal
import logging
import time
from uuid import UUID

import asyncpg
import stripe

from app.core.config import settings

from . import repository
from .schemas import DailyUsage, UsageByModel, UsageSummary

logger = logging.getLogger(__name__)


def get_stripe() -> stripe.Stripe:
    return stripe.Stripe(settings.STRIPE_SECRET_KEY)


async def get_or_create_stripe_customer(
    conn: asyncpg.Connection,
    user_id: UUID,
    email: str,
    name: str | None = None,
) -> str:
    """Return existing or newly created Stripe customer ID."""
    existing = await repository.get_stripe_customer(conn, user_id)
    if existing:
        return existing["stripe_customer_id"]

    client = get_stripe()
    customer = client.customers.create(
        email=email,
        name=name or email,
        metadata={"user_id": str(user_id)},
    )
    await repository.upsert_stripe_customer(conn, user_id, customer.id)
    logger.info("Created Stripe customer: user=%s customer=%s", user_id, customer.id)
    return customer.id


async def create_metered_subscription(
    conn: asyncpg.Connection,
    user_id: UUID,
    usage_price_id: str,
    base_price_id: str | None = None,
) -> dict:
    """Create a subscription for the user with an optional fixed base price and a metered item."""
    existing = await repository.get_stripe_customer(conn, user_id)
    if not existing:
        raise ValueError(f"No Stripe customer for user {user_id}. Create customer first.")

    customer_id = existing["stripe_customer_id"]
    if existing["stripe_subscription_id"]:
        return {
            "subscription_id": existing["stripe_subscription_id"],
            "already_existed": True,
        }

    client = get_stripe()
    subscription = client.subscriptions.create(
        customer=customer_id,
        items=[*([{"price": base_price_id}] if base_price_id else []), {"price": usage_price_id}],
        payment_behavior="default_incomplete",
        payment_settings={"save_default_payment_method": "on_subscription"},
        expand=["latest_invoice.payment_intent"],
    )

    metered_item = next(
        (
            item
            for item in subscription.items.data
            if getattr(item.price, "id", None) == usage_price_id
        ),
        subscription.items.data[-1] if subscription.items.data else None,
    )
    if metered_item is None:
        raise ValueError("Stripe subscription created but no metered item was returned.")

    item_id = metered_item.id
    await repository.update_stripe_subscription(conn, user_id, subscription.id, item_id)
    logger.info(
        "Created Stripe subscription: user=%s sub=%s item=%s",
        user_id,
        subscription.id,
        item_id,
    )
    return {
        "subscription_id": subscription.id,
        "subscription_item_id": item_id,
        "client_secret": (
            subscription.latest_invoice.payment_intent.client_secret
            if subscription.latest_invoice
            and hasattr(subscription.latest_invoice, "payment_intent")
            and subscription.latest_invoice.payment_intent
            else None
        ),
        "already_existed": False,
    }


async def cancel_subscription(conn: asyncpg.Connection, user_id: UUID) -> None:
    existing = await repository.get_stripe_customer(conn, user_id)
    if not existing or not existing["stripe_subscription_id"]:
        raise ValueError("No active subscription found")

    client = get_stripe()
    client.subscriptions.cancel(existing["stripe_subscription_id"])
    await repository.update_stripe_subscription(conn, user_id, None, None)
    logger.info("Cancelled Stripe subscription for user=%s", user_id)


async def get_usage_summary(
    conn: asyncpg.Connection,
    user_id: UUID,
    days: int = 30,
) -> UsageSummary:
    summary_row = await repository.get_usage_summary(conn, user_id, days)
    by_model_rows = await repository.get_usage_by_model(conn, user_id, days)
    by_day_rows = await repository.get_usage_by_day(conn, user_id, days)

    by_model = [
        UsageByModel(
            provider=r["provider"],
            model=r["model"],
            input_tokens=r["input_tokens"],
            output_tokens=r["output_tokens"],
            total_tokens=r["input_tokens"] + r["output_tokens"],
            cost_usd=float(r["cost_usd"]),
            call_count=r["call_count"],
        )
        for r in by_model_rows
    ]

    by_day = [
        DailyUsage(
            date=r["date"],
            input_tokens=r["input_tokens"],
            output_tokens=r["output_tokens"],
            cost_usd=float(r["cost_usd"]),
            call_count=r["call_count"],
        )
        for r in by_day_rows
    ]

    total_input = summary_row.get("total_input_tokens", 0) or 0
    total_output = summary_row.get("total_output_tokens", 0) or 0

    return UsageSummary(
        period_days=days,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        total_tokens=total_input + total_output,
        total_cost_usd=float(summary_row.get("total_cost_usd", 0) or 0),
        call_count=summary_row.get("call_count", 0) or 0,
        by_model=by_model,
        by_day=by_day,
    )


async def report_usage_to_stripe(conn: asyncpg.Connection) -> dict:
    """Report all unreported usage records to Stripe metered billing."""
    batches = await repository.get_unreported_usage(conn)
    if not batches:
        return {"reported": 0, "skipped": 0}

    client = get_stripe()
    reported = 0
    skipped = 0

    for batch in batches:
        cost_usd: Decimal = batch["total_cost_usd"]
        # Convert to microdollars (integer) for Stripe usage units
        usage_units = int(cost_usd * 1_000_000)
        if usage_units <= 0:
            skipped += 1
            continue

        try:
            record = client.subscription_items.create_usage_record(
                batch["stripe_subscription_item_id"],
                quantity=usage_units,
                timestamp=int(time.time()),
                action="increment",
            )
            await repository.mark_usage_reported(conn, batch["usage_ids"], record.id)
            reported += 1
        except stripe.StripeError:
            logger.exception("Failed to report usage to Stripe for user=%s", batch["user_id"])
            skipped += 1

    logger.info("Stripe usage reporting: reported=%d skipped=%d", reported, skipped)
    return {"reported": reported, "skipped": skipped}

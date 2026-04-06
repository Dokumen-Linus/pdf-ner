import logging
import time

import stripe

from app.core.config import settings
from app.shared.infrastructure.db import get_pool

from ..domain.services import cost_to_microdollars
from ..infrastructure.repository import get_unreported_batches, mark_reported

logger = logging.getLogger(__name__)


def _get_stripe() -> stripe.Stripe:
    return stripe.Stripe(settings.STRIPE_SECRET_KEY)


async def report_usage_to_stripe() -> dict:
    """Batch-report all unreported LLM usage to Stripe metered billing."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        batches = await get_unreported_batches(conn)
        if not batches:
            return {"reported": 0, "skipped": 0}

        client = _get_stripe()
        reported = 0
        skipped = 0

        for batch in batches:
            usage_units = cost_to_microdollars(batch["total_cost_usd"])
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
                await mark_reported(conn, list(batch["usage_ids"]), record.id)
                reported += 1
            except stripe.StripeError:
                logger.exception("Stripe usage record failed for user=%s", batch["user_id"])
                skipped += 1

        return {"reported": reported, "skipped": skipped}

import logging
import time
from typing import Any
from uuid import UUID, uuid4

from app.core.config import settings
from app.shared.infrastructure.db import get_pool

from ..domain.services import cost_to_microdollars
from ..infrastructure.repository import create_report_batch_and_link_usage, get_unreported_batches

logger = logging.getLogger(__name__)


def _get_stripe() -> Any:
    import stripe

    return stripe.Stripe(settings.STRIPE_SECRET_KEY)


async def report_usage_to_stripe(project_id: UUID | None = None) -> dict:
    """Batch-report all unreported LLM usage to Stripe metered billing."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        batches = await get_unreported_batches(conn, project_id=project_id)
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

            identifier = str(uuid4())
            try:
                import stripe

                client.billing.meter_events.create(
                    event_name=settings.STRIPE_METER_EVENT_NAME,
                    identifier=identifier,
                    payload={
                        "stripe_customer_id": batch["stripe_customer_id"],
                        "value": str(usage_units),
                    },
                    timestamp=int(time.time()),
                )
                await create_report_batch_and_link_usage(
                    conn,
                    batch=batch,
                    stripe_meter_event_identifier=identifier,
                )
                reported += 1
            except stripe.StripeError:
                logger.exception(
                    "Stripe meter event failed for billing target user=%s org=%s",
                    batch["billing_user_id"],
                    batch["billing_organization_id"],
                )
                skipped += 1

        return {"reported": reported, "skipped": skipped}

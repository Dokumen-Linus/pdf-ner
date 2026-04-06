import asyncio
import logging

from app.main import app

from .application.workflows import report_usage_to_stripe

logger = logging.getLogger(__name__)


@app.task(name="billing.report_usage_to_stripe", bind=True, max_retries=3)
def report_usage_to_stripe_task(self):
    """Batch-report all unreported LLM usage to Stripe metered billing."""
    try:
        result = asyncio.run(report_usage_to_stripe())
        logger.info(
            "Stripe usage reported: reported=%d skipped=%d",
            result["reported"],
            result["skipped"],
        )
        return result
    except Exception as exc:
        logger.exception("billing.report_usage_to_stripe failed")
        raise self.retry(exc=exc, countdown=60)

import logging

import anyio

from app.main import app

from .application.workflows import charge_due_accounts

logger = logging.getLogger(__name__)


async def _charge_due_accounts(limit: int):
    return await charge_due_accounts(limit=limit)


@app.task(name="billing.charge_due_accounts", bind=True, max_retries=3)
def charge_due_accounts_task(self, limit: int = 100):
    try:
        result = anyio.run(_charge_due_accounts, limit)
        logger.info(
            "Billing charges complete: succeeded=%d failed=%d",
            result["succeeded"],
            result["failed"],
        )
        return result
    except Exception as exc:
        logger.exception("billing.charge_due_accounts failed")
        raise self.retry(exc=exc, countdown=60) from exc

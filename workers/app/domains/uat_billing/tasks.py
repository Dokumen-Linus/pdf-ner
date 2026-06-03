import logging

import anyio

from app.main import app

from .application.workflows import charge_account, charge_due_accounts, create_direct_payment

logger = logging.getLogger(__name__)


async def _create_direct_payment(account_type: str, account_id: str, amount_cents: int):
    return await create_direct_payment(
        account_type=account_type,
        account_id=account_id,
        amount_cents=amount_cents,
    )


async def _charge_account(account_type: str, account_id: str):
    return await charge_account(account_type=account_type, account_id=account_id)


async def _charge_due_accounts(limit: int):
    return await charge_due_accounts(limit=limit)


@app.task(name="uat_billing.create_direct_payment", bind=True, max_retries=0)
def create_direct_payment_task(
    self,
    account_type: str,
    account_id: str,
    amount_cents: int,
):
    try:
        return anyio.run(_create_direct_payment, account_type, account_id, amount_cents)
    except Exception:
        logger.exception("uat_billing.create_direct_payment failed")
        raise


@app.task(name="uat_billing.charge_account", bind=True, max_retries=0)
def charge_account_task(self, account_type: str, account_id: str):
    try:
        return anyio.run(_charge_account, account_type, account_id)
    except Exception:
        logger.exception("uat_billing.charge_account failed")
        raise


@app.task(name="uat_billing.charge_due_accounts", bind=True, max_retries=0)
def charge_due_accounts_task(self, limit: int = 100):
    try:
        return anyio.run(_charge_due_accounts, limit)
    except Exception:
        logger.exception("uat_billing.charge_due_accounts failed")
        raise

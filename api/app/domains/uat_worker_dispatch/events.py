from celery.result import AsyncResult

from app.core.messaging import celery_client, celery_message_headers


def dispatch_direct_payment(*, account_type: str, account_id: str, amount_cents: int) -> str:
    result = celery_client.send_task(
        "uat_billing.create_direct_payment",
        args=[account_type, account_id, amount_cents],
        headers=celery_message_headers(),
    )
    return result.id


def dispatch_current_cycle(*, account_type: str, account_id: str) -> str:
    result = celery_client.send_task(
        "uat_billing.charge_account",
        args=[account_type, account_id],
        headers=celery_message_headers(),
    )
    return result.id


def dispatch_due_accounts(*, limit: int) -> str:
    result = celery_client.send_task(
        "uat_billing.charge_due_accounts",
        kwargs={"limit": limit},
        headers=celery_message_headers(),
    )
    return result.id


def get_task_status(task_id: str) -> dict:
    result = AsyncResult(task_id, app=celery_client)
    response: dict = {
        "task_id": task_id,
        "status": result.status,
    }
    if result.ready():
        if result.successful():
            response["result"] = result.result
        else:
            response["error"] = str(result.result)
    elif result.info and isinstance(result.info, dict):
        response["progress"] = result.info
    return response

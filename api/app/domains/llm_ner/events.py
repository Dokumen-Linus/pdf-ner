from decimal import Decimal

from celery.result import AsyncResult

from app.core.messaging import celery_client, celery_message_headers


def dispatch_optimize_prompt(
    project_id: str,
    template_id: int,
    max_cost_usd: Decimal = Decimal("1.00"),
    model: str = "gpt-4o",
) -> str:
    """Send optimize_prompt task to the workers queue via Celery.

    Returns the Celery task ID for status polling.
    """
    result = celery_client.send_task(
        "context_engineering.optimize_prompt",
        args=[project_id],
        kwargs={"template_id": template_id, "max_cost_usd": str(max_cost_usd), "model": model},
        headers=celery_message_headers(),
    )
    return result.id


def get_task_status(task_id: str) -> dict:
    """Query Celery result backend for current task state."""
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

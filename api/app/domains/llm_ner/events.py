from celery.result import AsyncResult

from app.core.messaging import celery_client


def dispatch_optimize_prompt(
    project_id: str, max_iterations: int = 5, model: str = "gpt-4o"
) -> str:
    """Send optimize_prompt task to the workers queue via Celery.

    Returns the Celery task ID for status polling.
    """
    result = celery_client.send_task(
        "context_engineering.optimize_prompt",
        args=[project_id],
        kwargs={"max_iterations": max_iterations, "model": model},
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

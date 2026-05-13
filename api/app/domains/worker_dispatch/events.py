from celery.result import AsyncResult

from app.core.messaging import celery_client, celery_message_headers


def dispatch_optimize_prompt(
    project_id: str,
    template_id: int,
    labeled_pdfs: list[str],
    beta: float = 1.0,
    max_cost_usd: float = 1.0,
    ner_chat_model: str = "gpt-5.4-mini",
    prompt_eng_chat_model: str = "gpt-5.4-mini",
    convergence_threshold: float = 0.02,
) -> str:
    """Send optimize_prompt task to the workers queue via Celery.

    Returns the Celery task ID for status polling.
    """
    result = celery_client.send_task(
        "context_engineering.optimize_prompt",
        args=[project_id],
        kwargs={
            "template_id": template_id,
            "labeled_pdfs": labeled_pdfs,
            "beta": beta,
            "max_cost_usd": max_cost_usd,
            "ner_chat_model": ner_chat_model,
            "prompt_eng_chat_model": prompt_eng_chat_model,
            "convergence_threshold": convergence_threshold,
        },
        headers=celery_message_headers(),
    )
    return result.id


def dispatch_ocr_evaluation(
    project_id: str,
    judge_model: str,
    max_pdfs: int = 5,
    max_pages_per_pdf: int = 3,
    max_cost_usd: float = 0.5,
    pdf_ids: list[str] | None = None,
    gpu_model: str = "olm-ocr2",
    ocr_only: bool = True,
) -> str:
    """Send OCR evaluation task to the workers queue via Celery."""
    result = celery_client.send_task(
        "ocr_evaluation.evaluate_project",
        args=[project_id, judge_model],
        kwargs={
            "max_pdfs": max_pdfs,
            "max_pages_per_pdf": max_pages_per_pdf,
            "max_cost_usd": max_cost_usd,
            "pdf_ids": pdf_ids,
            "gpu_model": gpu_model,
            "ocr_only": ocr_only,
        },
        headers=celery_message_headers(),
    )
    return result.id


def dispatch_text_extract(
    project_id: str,
    pdf_ids: list[str],
    extract_method: str,
) -> str:
    """Send text extraction batch task to the workers queue via Celery."""
    result = celery_client.send_task(
        "text_extract.extract_missing_pdf_texts",
        args=[project_id, pdf_ids, extract_method],
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

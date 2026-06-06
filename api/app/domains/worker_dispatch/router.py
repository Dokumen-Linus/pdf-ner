import time

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.db import get_conn
from app.domains.shared.schemas import MonitoringEventInput
from app.domains.shared.service import (
    error_fields,
    monotonic_ms,
    record_monitoring_event,
    request_context,
)

from . import events, repository
from .schemas import (
    ActivatePromptRequest,
    ChatModelEvalRequest,
    ExtractTextBatchRequest,
    OcrEvaluationPdfsRequest,
    OcrEvaluationRequest,
    OptimizePromptRequest,
)

router = APIRouter(prefix="/worker-dispatch", tags=["worker-dispatch"])

TASK_PROJECT_KEY_PREFIX = "worker-dispatch:task:project:"
TASK_PROJECT_TTL = 86400  # 24 hours


async def _store_task_project(request: Request, task_id: str, project_id: object) -> None:
    await request.app.state.redis.set(
        f"{TASK_PROJECT_KEY_PREFIX}{task_id}",
        str(project_id),
        ex=TASK_PROJECT_TTL,
    )


async def _task_status_with_project(request: Request, task_id: str) -> dict:
    project_id = await request.app.state.redis.get(f"{TASK_PROJECT_KEY_PREFIX}{task_id}")
    if isinstance(project_id, bytes):
        project_id = project_id.decode()

    status = events.get_task_status(task_id)
    status["project_id"] = project_id
    return status


async def _record_dispatch_event(
    conn: asyncpg.Connection,
    request: Request,
    *,
    event_name: str,
    status: str,
    project_id: object | None,
    task_id: str | None,
    started_at: float,
    metadata: dict,
    error: Exception | None = None,
) -> None:
    context = request_context(request)
    error_data = error_fields(error) if error is not None else {}
    await record_monitoring_event(
        conn,
        MonitoringEventInput(
            event_name=event_name,
            event_kind="dispatch",
            operation_type="mutation",
            source="api.worker_dispatch",
            status=status,
            project_id=project_id,
            resource_type="worker_task",
            resource_id=task_id,
            task_id=task_id,
            task_name=event_name.removeprefix("api.worker_dispatch."),
            duration_ms=monotonic_ms(started_at),
            metadata=metadata,
            raw_error_payload=metadata if error is not None else None,
            **context,
            **error_data,
        ),
    )


@router.post("/optimize-prompt")
async def optimize_prompt(
    request_data: OptimizePromptRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
    started_at = time.perf_counter()
    task_id = None
    metadata = {
        "template_id": request_data.template_id,
        "labeled_pdf_count": len(request_data.labeled_pdfs),
        "beta": request_data.beta,
        "max_cost_usd": request_data.max_cost_usd,
        "ner_chat_model": request_data.ner_chat_model,
        "prompt_eng_chat_model": request_data.prompt_eng_chat_model,
        "convergence_threshold": request_data.convergence_threshold,
    }
    try:
        task_id = events.dispatch_optimize_prompt(
            project_id=str(request_data.project_id),
            template_id=request_data.template_id,
            labeled_pdfs=[str(pdf_id) for pdf_id in request_data.labeled_pdfs],
            beta=request_data.beta,
            max_cost_usd=request_data.max_cost_usd,
            ner_chat_model=request_data.ner_chat_model,
            prompt_eng_chat_model=request_data.prompt_eng_chat_model,
            convergence_threshold=request_data.convergence_threshold,
        )

        await _store_task_project(request, task_id, request_data.project_id)
    except Exception as exc:
        await _record_dispatch_event(
            conn,
            request,
            event_name="api.worker_dispatch.optimize_prompt",
            status="failure",
            project_id=request_data.project_id,
            task_id=task_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_dispatch_event(
        conn,
        request,
        event_name="api.worker_dispatch.optimize_prompt",
        status="success",
        project_id=request_data.project_id,
        task_id=task_id,
        started_at=started_at,
        metadata=metadata,
    )

    return {"task_id": task_id}


@router.get("/optimize-prompt/{task_id}/status")
async def get_optimize_prompt_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)


@router.post("/ocr-evaluation")
async def evaluate_ocr(
    request_data: OcrEvaluationRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
    started_at = time.perf_counter()
    task_id = None
    metadata = {
        "judge_model": request_data.judge_model,
        "max_pdfs": request_data.max_pdfs,
        "max_pages_per_pdf": request_data.max_pages_per_pdf,
        "max_cost_usd": request_data.max_cost_usd,
        "gpu_model": request_data.gpu_model,
        "ocr_only": request_data.ocr_only,
        "pdf_count": len(request_data.pdf_ids or []),
        "has_explicit_pdf_ids": request_data.pdf_ids is not None,
    }
    try:
        task_id = events.dispatch_ocr_evaluation(
            project_id=str(request_data.project_id),
            judge_model=request_data.judge_model,
            max_pdfs=request_data.max_pdfs,
            max_pages_per_pdf=request_data.max_pages_per_pdf,
            max_cost_usd=request_data.max_cost_usd,
            pdf_ids=[str(pdf_id) for pdf_id in request_data.pdf_ids]
            if request_data.pdf_ids is not None
            else None,
            gpu_model=request_data.gpu_model,
            ocr_only=request_data.ocr_only,
        )

        await _store_task_project(request, task_id, request_data.project_id)
    except Exception as exc:
        await _record_dispatch_event(
            conn,
            request,
            event_name="api.worker_dispatch.ocr_evaluation",
            status="failure",
            project_id=request_data.project_id,
            task_id=task_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_dispatch_event(
        conn,
        request,
        event_name="api.worker_dispatch.ocr_evaluation",
        status="success",
        project_id=request_data.project_id,
        task_id=task_id,
        started_at=started_at,
        metadata=metadata,
    )

    return {"task_id": task_id}


@router.post("/ocr-evaluation/pdfs")
async def evaluate_ocr_pdfs(
    request_data: OcrEvaluationPdfsRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
    started_at = time.perf_counter()
    task_id = None
    metadata = {
        "judge_model": request_data.judge_model,
        "max_pdfs": request_data.max_pdfs,
        "max_pages_per_pdf": request_data.max_pages_per_pdf,
        "max_cost_usd": request_data.max_cost_usd,
        "gpu_model": request_data.gpu_model,
        "ocr_only": request_data.ocr_only,
        "pdf_count": len(request_data.pdf_ids),
        "has_explicit_pdf_ids": True,
    }
    try:
        task_id = events.dispatch_ocr_evaluation(
            project_id=str(request_data.project_id),
            judge_model=request_data.judge_model,
            max_pdfs=request_data.max_pdfs,
            max_pages_per_pdf=request_data.max_pages_per_pdf,
            max_cost_usd=request_data.max_cost_usd,
            pdf_ids=[str(pdf_id) for pdf_id in request_data.pdf_ids],
            gpu_model=request_data.gpu_model,
            ocr_only=request_data.ocr_only,
        )

        await _store_task_project(request, task_id, request_data.project_id)
    except Exception as exc:
        await _record_dispatch_event(
            conn,
            request,
            event_name="api.worker_dispatch.ocr_evaluation_pdfs",
            status="failure",
            project_id=request_data.project_id,
            task_id=task_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_dispatch_event(
        conn,
        request,
        event_name="api.worker_dispatch.ocr_evaluation_pdfs",
        status="success",
        project_id=request_data.project_id,
        task_id=task_id,
        started_at=started_at,
        metadata=metadata,
    )

    return {"task_id": task_id}


@router.get("/ocr-evaluation/{task_id}/status")
async def get_ocr_evaluation_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)


@router.post("/chat-model-eval")
async def evaluate_chat_models(
    request_data: ChatModelEvalRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
    started_at = time.perf_counter()
    task_id = None
    metadata = {
        "pdf_count": len(request_data.pdf_ids),
        "chat_model_ids": request_data.chat_model_ids,
        "beta": request_data.beta,
    }
    try:
        unknown_pdf_ids = await repository.fetch_pdf_ids_outside_project(
            conn,
            project_id=request_data.project_id,
            pdf_ids=request_data.pdf_ids,
        )
        if unknown_pdf_ids:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "All pdf_ids must belong to project_id",
                    "pdf_ids": [str(pdf_id) for pdf_id in unknown_pdf_ids],
                },
            )

        unavailable_models = await repository.fetch_unavailable_chat_model_ids(
            conn,
            chat_model_ids=request_data.chat_model_ids,
        )
        if unavailable_models:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "All chat_model_ids must reference available public.chat_models",
                    "chat_model_ids": unavailable_models,
                },
            )

        task_id = events.dispatch_chat_model_eval(
            project_id=str(request_data.project_id),
            pdf_ids=[str(pdf_id) for pdf_id in request_data.pdf_ids],
            chat_model_ids=request_data.chat_model_ids,
            beta=request_data.beta,
        )

        await _store_task_project(request, task_id, request_data.project_id)
    except Exception as exc:
        await _record_dispatch_event(
            conn,
            request,
            event_name="api.worker_dispatch.chat_model_eval",
            status="failure",
            project_id=request_data.project_id,
            task_id=task_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_dispatch_event(
        conn,
        request,
        event_name="api.worker_dispatch.chat_model_eval",
        status="success",
        project_id=request_data.project_id,
        task_id=task_id,
        started_at=started_at,
        metadata=metadata,
    )

    return {"task_id": task_id}


@router.get("/chat-model-eval/{task_id}/status")
async def get_chat_model_eval_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)


@router.post("/activate-prompt")
async def activate_prompt(
    request_data: ActivatePromptRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
    started_at = time.perf_counter()
    task_id = None
    metadata = {"prompt_id": str(request_data.prompt_id)}
    try:
        if not await repository.prompt_belongs_to_project(
            conn,
            project_id=request_data.project_id,
            prompt_id=request_data.prompt_id,
        ):
            raise HTTPException(
                status_code=422,
                detail="prompt_id must belong to project_id",
            )

        task_id = events.dispatch_activate_prompt(
            project_id=str(request_data.project_id),
            prompt_id=str(request_data.prompt_id),
        )

        await _store_task_project(request, task_id, request_data.project_id)
    except Exception as exc:
        await _record_dispatch_event(
            conn,
            request,
            event_name="api.worker_dispatch.activate_prompt",
            status="failure",
            project_id=request_data.project_id,
            task_id=task_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_dispatch_event(
        conn,
        request,
        event_name="api.worker_dispatch.activate_prompt",
        status="success",
        project_id=request_data.project_id,
        task_id=task_id,
        started_at=started_at,
        metadata=metadata,
    )

    return {"task_id": task_id}


@router.get("/activate-prompt/{task_id}/status")
async def get_activate_prompt_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)


@router.post("/text-extract")
async def extract_text_batch(
    request_data: ExtractTextBatchRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
    started_at = time.perf_counter()
    task_id = None
    metadata = {
        "pdf_count": len(request_data.pdf_ids),
        "extract_method": request_data.extract_method,
    }
    try:
        unknown_pdf_ids = await repository.fetch_pdf_ids_outside_project(
            conn,
            project_id=request_data.project_id,
            pdf_ids=request_data.pdf_ids,
        )
        if unknown_pdf_ids:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "All pdf_ids must belong to project_id",
                    "pdf_ids": [str(pdf_id) for pdf_id in unknown_pdf_ids],
                },
            )

        task_id = events.dispatch_text_extract(
            project_id=str(request_data.project_id),
            pdf_ids=[str(pdf_id) for pdf_id in request_data.pdf_ids],
            extract_method=request_data.extract_method,
        )

        await _store_task_project(request, task_id, request_data.project_id)
    except Exception as exc:
        await _record_dispatch_event(
            conn,
            request,
            event_name="api.worker_dispatch.text_extract",
            status="failure",
            project_id=request_data.project_id,
            task_id=task_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_dispatch_event(
        conn,
        request,
        event_name="api.worker_dispatch.text_extract",
        status="success",
        project_id=request_data.project_id,
        task_id=task_id,
        started_at=started_at,
        metadata=metadata,
    )

    return {"task_id": task_id}


@router.get("/text-extract/{task_id}/status")
async def get_text_extract_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)

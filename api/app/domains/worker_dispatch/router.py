import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.db import get_conn

from . import events, repository
from .schemas import (
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


@router.post("/optimize-prompt")
async def optimize_prompt(
    request_data: OptimizePromptRequest,
    request: Request,
):
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

    return {"task_id": task_id}


@router.get("/optimize-prompt/{task_id}/status")
async def get_optimize_prompt_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)


@router.post("/ocr-evaluation")
async def evaluate_ocr(
    request_data: OcrEvaluationRequest,
    request: Request,
):
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

    return {"task_id": task_id}


@router.post("/ocr-evaluation/pdfs")
async def evaluate_ocr_pdfs(
    request_data: OcrEvaluationPdfsRequest,
    request: Request,
):
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

    return {"task_id": task_id}


@router.get("/ocr-evaluation/{task_id}/status")
async def get_ocr_evaluation_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)


@router.post("/text-extract")
async def extract_text_batch(
    request_data: ExtractTextBatchRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
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

    return {"task_id": task_id}


@router.get("/text-extract/{task_id}/status")
async def get_text_extract_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)

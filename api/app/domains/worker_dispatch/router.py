from fastapi import APIRouter, Request

from . import events
from .schemas import OcrEvaluationRequest, OptimizePromptRequest

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
        max_cost_usd=request_data.max_cost_usd,
        model=request_data.model,
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
    )

    await _store_task_project(request, task_id, request_data.project_id)

    return {"task_id": task_id}


@router.get("/ocr-evaluation/{task_id}/status")
async def get_ocr_evaluation_status(task_id: str, request: Request):
    return await _task_status_with_project(request, task_id)

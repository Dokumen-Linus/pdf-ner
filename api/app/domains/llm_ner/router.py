import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.db import get_conn
from app.core.dependencies import get_llm_clients

from . import events, repository, service
from .schemas import ExtractEntitiesRequest, OptimizePromptRequest

router = APIRouter(prefix="/llm-ner", tags=["llm-ner"])

TASK_PROJECT_KEY_PREFIX = "task:project:"
TASK_PROJECT_TTL = 86400  # 24 hours


@router.post("/extract")
async def extract_entities(
    request_data: ExtractEntitiesRequest,
    conn: asyncpg.Connection = Depends(get_conn),
    clients: dict = Depends(get_llm_clients),
):
    return await service.extract_entities(conn, clients, request_data)


@router.post("/optimize-prompt")
async def optimize_prompt(
    request_data: OptimizePromptRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
):
    # Validate project exists before dispatching expensive background work
    project = await repository.fetch_project(conn, request_data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task_id = events.dispatch_optimize_prompt(
        project_id=str(request_data.project_id),
        max_iterations=request_data.max_iterations,
        model=request_data.model,
    )

    # Store task -> project mapping for ownership verification on status reads
    await request.app.state.redis.set(
        f"{TASK_PROJECT_KEY_PREFIX}{task_id}",
        str(request_data.project_id),
        ex=TASK_PROJECT_TTL,
    )

    return {"task_id": task_id}


@router.get("/optimize-prompt/{task_id}/status")
async def get_optimize_prompt_status(task_id: str, request: Request):
    # Lookup project_id so web layer can verify ownership
    project_id = await request.app.state.redis.get(f"{TASK_PROJECT_KEY_PREFIX}{task_id}")

    status = events.get_task_status(task_id)
    status["project_id"] = project_id  # None if task unknown or expired

    return status

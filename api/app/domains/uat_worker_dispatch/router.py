import json

from fastapi import APIRouter, Request

from . import events
from .schemas import CurrentCycleRequest, DirectPaymentRequest, DueAccountsRequest

router = APIRouter(prefix="/uat-worker-dispatch", tags=["uat-worker-dispatch"])

TASK_METADATA_KEY_PREFIX = "uat-worker-dispatch:task:"
TASK_METADATA_TTL = 3600


async def _store_task_metadata(
    request: Request,
    *,
    task_id: str,
    action: str,
    metadata: dict[str, object],
) -> None:
    await request.app.state.redis.set(
        f"{TASK_METADATA_KEY_PREFIX}{task_id}",
        json.dumps({"action": action, **metadata}),
        ex=TASK_METADATA_TTL,
    )


async def _task_status_with_metadata(request: Request, task_id: str) -> dict:
    metadata = await request.app.state.redis.get(f"{TASK_METADATA_KEY_PREFIX}{task_id}")
    if isinstance(metadata, bytes):
        metadata = metadata.decode()
    status = events.get_task_status(task_id)
    status["metadata"] = json.loads(metadata) if metadata else None
    return status


@router.post("/billing/direct-payment")
async def create_direct_payment(request_data: DirectPaymentRequest, request: Request):
    task_id = events.dispatch_direct_payment(
        account_type=request_data.account_type,
        account_id=request_data.account_id,
        amount_cents=request_data.amount_cents,
    )
    await _store_task_metadata(
        request,
        task_id=task_id,
        action="direct_payment",
        metadata=request_data.model_dump(),
    )
    return {"task_id": task_id}


@router.post("/billing/current-cycle")
async def charge_current_cycle(request_data: CurrentCycleRequest, request: Request):
    task_id = events.dispatch_current_cycle(
        account_type=request_data.account_type,
        account_id=request_data.account_id,
    )
    await _store_task_metadata(
        request,
        task_id=task_id,
        action="current_cycle",
        metadata=request_data.model_dump(),
    )
    return {"task_id": task_id}


@router.post("/billing/due-accounts")
async def charge_due_accounts(request_data: DueAccountsRequest, request: Request):
    task_id = events.dispatch_due_accounts(limit=request_data.limit)
    await _store_task_metadata(
        request,
        task_id=task_id,
        action="due_accounts",
        metadata=request_data.model_dump(),
    )
    return {"task_id": task_id}


@router.get("/tasks/{task_id}/status")
async def get_task_status(task_id: str, request: Request):
    return await _task_status_with_metadata(request, task_id)

from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.db import get_conn

from . import repository, service
from .schemas import (
    CancelSubscriptionRequest,
    CreateCustomerRequest,
    CreateSubscriptionRequest,
    StripeCustomerResponse,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/customer", response_model=None)
async def create_or_get_customer(
    request: CreateCustomerRequest,
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Create or retrieve the Stripe customer for a user."""
    try:
        customer_id = await service.get_or_create_stripe_customer(
            conn,
            request.user_id,
            request.email,
            request.name,
        )
        record = await repository.get_stripe_customer(conn, request.user_id)
        return StripeCustomerResponse(
            stripe_customer_id=customer_id,
            stripe_subscription_id=record["stripe_subscription_id"] if record else None,
            has_active_subscription=bool(record and record["stripe_subscription_id"]),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/usage", response_model=None)
async def get_usage(
    user_id: UUID = Query(...),
    days: int = Query(default=30, ge=1, le=365),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Get usage summary for a user over the last N days."""
    return await service.get_usage_summary(conn, user_id, days)


@router.post("/subscription", response_model=None)
async def create_subscription(
    request: CreateSubscriptionRequest,
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Create a Stripe subscription with an optional base fee plus metered usage."""
    try:
        return await service.create_metered_subscription(
            conn,
            request.user_id,
            request.usage_price_id,
            request.base_price_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/subscription", response_model=None)
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Cancel the active subscription for a user."""
    try:
        await service.cancel_subscription(conn, request.user_id)
        return {"cancelled": True}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/report-to-stripe", response_model=None)
async def trigger_stripe_reporting(
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Manually trigger unreported usage → Stripe reporting. Also triggered by Celery."""
    return await service.report_usage_to_stripe(conn)

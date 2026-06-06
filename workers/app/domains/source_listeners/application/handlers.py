from __future__ import annotations

import time
from typing import Any

from app.domains.source_watchers.domain.services import extraction_task_args
from app.shared.infrastructure.db import get_pool
from app.shared.infrastructure.event_publisher import publish_source_integration_event
from app.shared.infrastructure.redis import RedisLock

from ..infrastructure import provider_registry
from ..infrastructure import repositories as repo
from .commands import CreateListener, DisableListener, HandleListenerEvent, RenewListener


async def handle_create_listener(cmd: CreateListener, task: Any | None = None) -> dict:
    started_at = time.perf_counter()
    task_id = getattr(getattr(task, "request", None), "id", None)
    async with RedisLock(f"listener:create:{cmd.connection_id}", ttl=900) as lock:
        if not lock.acquired:
            await publish_source_integration_event(
                event_name="workers.source_listeners.create.skipped",
                status="skipped",
                source="source_listeners.create_listener",
                resource_type="listener",
                resource_id=str(cmd.connection_id),
                task_id=task_id,
                metadata={"lock_acquired": False, "reason": "locked"},
                started_at=started_at,
            )
            return {"status": "skipped", "reason": "locked"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            connection = None
            try:
                connection = await repo.fetch_connection(conn, cmd.connection_id)
                if connection is None:
                    raise LookupError(f"Source connection not found: {cmd.connection_id}")
                listener = provider_registry.registry.resolve(connection["provider"])
                payload = await listener.create(dict(connection))
                subscription_id = await repo.activate_listener(
                    conn, cmd.connection_id, connection["provider"], payload
                )
                await publish_source_integration_event(
                    event_name="workers.source_listeners.create.succeeded",
                    status="succeeded",
                    source="source_listeners.create_listener",
                    project_id=connection["project_id"],
                    resource_type="listener",
                    resource_id=str(subscription_id),
                    task_id=task_id,
                    metadata={
                        "provider": connection["provider"],
                        "source_connection_id": str(connection["source_connection_id"]),
                        "status": "active",
                        "expires_at": payload.expires_at.isoformat()
                        if payload.expires_at
                        else None,
                        "renew_after": payload.renew_after.isoformat()
                        if payload.renew_after
                        else None,
                        "has_provider_subscription_id": bool(payload.provider_subscription_id),
                        "lock_acquired": True,
                    },
                    started_at=started_at,
                )
                return {"listener_subscription_id": str(subscription_id)}
            except Exception as exc:
                await publish_source_integration_event(
                    event_name="workers.source_listeners.create.failed",
                    status="failed",
                    source="source_listeners.create_listener",
                    project_id=connection["project_id"] if connection else None,
                    resource_type="listener",
                    resource_id=str(cmd.connection_id),
                    task_id=task_id,
                    metadata={
                        "failure_stage": "provider_create",
                        "provider": connection["provider"] if connection else None,
                        "lock_acquired": True,
                    },
                    error=exc,
                    started_at=started_at,
                )
                raise


async def handle_renew_listener(cmd: RenewListener, task: Any | None = None) -> dict:
    started_at = time.perf_counter()
    task_id = getattr(getattr(task, "request", None), "id", None)
    async with RedisLock(f"listener:renew:{cmd.listener_subscription_id}", ttl=900) as lock:
        if not lock.acquired:
            await publish_source_integration_event(
                event_name="workers.source_listeners.renew.skipped",
                status="skipped",
                source="source_listeners.renew_listener",
                resource_type="listener",
                resource_id=str(cmd.listener_subscription_id),
                task_id=task_id,
                metadata={"lock_acquired": False, "reason": "locked"},
                started_at=started_at,
            )
            return {"status": "skipped", "reason": "locked"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            subscription = None
            try:
                subscription = await repo.fetch_subscription(conn, cmd.listener_subscription_id)
                if subscription is None:
                    raise LookupError(
                        f"Listener subscription not found: {cmd.listener_subscription_id}"
                    )
                listener = provider_registry.registry.resolve(subscription["provider"])
                payload = await listener.renew(dict(subscription))
                await repo.update_subscription(conn, cmd.listener_subscription_id, payload)
                await publish_source_integration_event(
                    event_name="workers.source_listeners.renew.succeeded",
                    status="succeeded",
                    source="source_listeners.renew_listener",
                    resource_type="listener",
                    resource_id=str(cmd.listener_subscription_id),
                    task_id=task_id,
                    metadata={
                        "provider": subscription["provider"],
                        "status": "active",
                        "expires_at": payload.expires_at.isoformat()
                        if payload.expires_at
                        else None,
                        "renew_after": payload.renew_after.isoformat()
                        if payload.renew_after
                        else None,
                        "has_provider_subscription_id": bool(payload.provider_subscription_id),
                        "lock_acquired": True,
                    },
                    started_at=started_at,
                )
                return {
                    "listener_subscription_id": str(cmd.listener_subscription_id),
                    "status": "active",
                }
            except Exception as exc:
                await publish_source_integration_event(
                    event_name="workers.source_listeners.renew.failed",
                    status="failed",
                    source="source_listeners.renew_listener",
                    resource_type="listener",
                    resource_id=str(cmd.listener_subscription_id),
                    task_id=task_id,
                    metadata={
                        "failure_stage": "provider_renew",
                        "provider": subscription["provider"] if subscription else None,
                        "lock_acquired": True,
                    },
                    error=exc,
                    started_at=started_at,
                )
                raise


async def handle_disable_listener(cmd: DisableListener, task: Any | None = None) -> dict:
    started_at = time.perf_counter()
    task_id = getattr(getattr(task, "request", None), "id", None)
    pool = await get_pool()
    async with pool.acquire() as conn:
        subscription = None
        try:
            subscription = await repo.fetch_subscription(conn, cmd.listener_subscription_id)
            if subscription is None:
                raise LookupError(
                    f"Listener subscription not found: {cmd.listener_subscription_id}"
                )
            listener = provider_registry.registry.resolve(subscription["provider"])
            await listener.disable(dict(subscription))
            await repo.disable_subscription(conn, cmd.listener_subscription_id)
            await publish_source_integration_event(
                event_name="workers.source_listeners.disable.succeeded",
                status="succeeded",
                source="source_listeners.disable_listener",
                resource_type="listener",
                resource_id=str(cmd.listener_subscription_id),
                task_id=task_id,
                metadata={"provider": subscription["provider"], "status": "disabled"},
                started_at=started_at,
            )
            return {
                "listener_subscription_id": str(cmd.listener_subscription_id),
                "status": "disabled",
            }
        except Exception as exc:
            await publish_source_integration_event(
                event_name="workers.source_listeners.disable.failed",
                status="failed",
                source="source_listeners.disable_listener",
                resource_type="listener",
                resource_id=str(cmd.listener_subscription_id),
                task_id=task_id,
                metadata={
                    "failure_stage": "provider_disable",
                    "provider": subscription["provider"] if subscription else None,
                },
                error=exc,
                started_at=started_at,
            )
            raise


async def handle_listener_event(cmd: HandleListenerEvent, task: Any | None = None) -> dict:
    from app.domains.ner_workflows.tasks import process_document_source_task

    started_at = time.perf_counter()
    task_id = getattr(getattr(task, "request", None), "id", None)
    pool = await get_pool()
    async with pool.acquire() as conn:
        subscription = None
        try:
            subscription = await repo.fetch_subscription(conn, cmd.listener_subscription_id)
            if subscription is None:
                raise LookupError(
                    f"Listener subscription not found: {cmd.listener_subscription_id}"
                )
            listener = provider_registry.registry.resolve(subscription["provider"])
            event = await listener.normalize_event(dict(subscription), cmd.event_payload)
        except Exception as exc:
            await publish_source_integration_event(
                event_name="workers.source_listeners.event.failed",
                status="failed",
                source="source_listeners.handle_listener_event",
                resource_type="listener",
                resource_id=str(cmd.listener_subscription_id),
                task_id=task_id,
                metadata={
                    "failure_stage": "normalize_event",
                    "provider": subscription["provider"] if subscription else None,
                },
                error=exc,
                started_at=started_at,
            )
            raise

    enqueued = 0
    for document in event.documents:
        args = extraction_task_args(document.source_id)
        process_document_source_task.delay(*args)
        enqueued += 1
    await publish_source_integration_event(
        event_name="workers.source_listeners.event.succeeded",
        status="succeeded",
        source="source_listeners.handle_listener_event",
        resource_type="listener",
        resource_id=str(cmd.listener_subscription_id),
        task_id=task_id,
        metadata={
            "provider": subscription["provider"],
            "document_count": len(event.documents),
            "enqueued_count": enqueued,
        },
        started_at=started_at,
    )
    return {"enqueued": enqueued}

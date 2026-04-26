from __future__ import annotations

from app.domains.source_watchers.domain.services import extraction_task_args
from app.shared.infrastructure.db import get_pool
from app.shared.infrastructure.redis import RedisLock

from ..infrastructure import provider_registry
from ..infrastructure import repositories as repo
from .commands import CreateListener, DisableListener, HandleListenerEvent, RenewListener


async def handle_create_listener(cmd: CreateListener) -> dict:
    async with RedisLock(f"listener:create:{cmd.connection_id}", ttl=900) as lock:
        if not lock.acquired:
            return {"status": "skipped", "reason": "locked"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            connection = await repo.fetch_connection(conn, cmd.connection_id)
            if connection is None:
                raise LookupError(f"Source connection not found: {cmd.connection_id}")
            listener = provider_registry.registry.resolve(connection["provider"])
            payload = await listener.create(dict(connection))
            subscription_id = await repo.insert_subscription(
                conn, cmd.connection_id, connection["provider"], payload
            )
            return {"listener_subscription_id": str(subscription_id)}


async def handle_renew_listener(cmd: RenewListener) -> dict:
    async with RedisLock(f"listener:renew:{cmd.listener_subscription_id}", ttl=900) as lock:
        if not lock.acquired:
            return {"status": "skipped", "reason": "locked"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            subscription = await repo.fetch_subscription(conn, cmd.listener_subscription_id)
            if subscription is None:
                raise LookupError(f"Listener subscription not found: {cmd.listener_subscription_id}")
            listener = provider_registry.registry.resolve(subscription["provider"])
            payload = await listener.renew(dict(subscription))
            await repo.update_subscription(conn, cmd.listener_subscription_id, payload)
            return {"listener_subscription_id": str(cmd.listener_subscription_id), "status": "active"}


async def handle_disable_listener(cmd: DisableListener) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        subscription = await repo.fetch_subscription(conn, cmd.listener_subscription_id)
        if subscription is None:
            raise LookupError(f"Listener subscription not found: {cmd.listener_subscription_id}")
        listener = provider_registry.registry.resolve(subscription["provider"])
        await listener.disable(dict(subscription))
        await repo.disable_subscription(conn, cmd.listener_subscription_id)
        return {"listener_subscription_id": str(cmd.listener_subscription_id), "status": "disabled"}


async def handle_listener_event(cmd: HandleListenerEvent) -> dict:
    from app.domains.entity_extraction.tasks import process_document_source_task

    pool = await get_pool()
    async with pool.acquire() as conn:
        subscription = await repo.fetch_subscription(conn, cmd.listener_subscription_id)
        if subscription is None:
            raise LookupError(f"Listener subscription not found: {cmd.listener_subscription_id}")
        listener = provider_registry.registry.resolve(subscription["provider"])
        event = await listener.normalize_event(dict(subscription), cmd.event_payload)

    enqueued = 0
    for document in event.documents:
        args = extraction_task_args(document.document_source_id, subscription["optimized_prompt_id"])
        process_document_source_task.delay(*args)
        enqueued += 1
    return {"enqueued": enqueued}


from __future__ import annotations

from app.shared.infrastructure.db import get_pool
from app.shared.infrastructure.redis import RedisLock

from ..domain.services import extraction_task_args
from ..infrastructure import provider_registry
from ..infrastructure import repositories as repo
from .commands import DispatchDueWatchers, PollSourceConnection


async def handle_dispatch_due_watchers(cmd: DispatchDueWatchers) -> dict:
    from ..tasks import poll_source_connection_task

    pool = await get_pool()
    async with pool.acquire() as conn:
        connection_ids = await repo.fetch_due_connection_ids(conn, cmd.limit)

    for connection_id in connection_ids:
        poll_source_connection_task.delay(str(connection_id))

    return {"dispatched": len(connection_ids)}


async def handle_poll_source_connection(cmd: PollSourceConnection) -> dict:
    from app.domains.ner_workflows.tasks import process_document_source_task

    async with RedisLock(f"watch:{cmd.connection_id}", ttl=900) as lock:
        if not lock.acquired:
            return {"status": "skipped", "reason": "locked"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            connection = await repo.fetch_connection(conn, cmd.connection_id)
            if connection is None:
                raise LookupError(f"Source connection not found: {cmd.connection_id}")

            cursor_before = await repo.fetch_cursor(conn, cmd.connection_id)
            run_id = await repo.insert_watch_run(conn, cmd.connection_id, cursor_before)
            connection["watcher_run_id"] = run_id
            try:
                watcher = provider_registry.build_registry(conn).resolve(connection["provider"])
                result = await watcher.discover(dict(connection), cursor_before)
                enqueued_count = 0
                for document in result.documents:
                    if document.materialized is not None and document.materialized.is_new:
                        args = extraction_task_args(document.materialized.source_id)
                        process_document_source_task.delay(*args)
                        enqueued_count += 1
                await repo.complete_watch_run(
                    conn,
                    run_id,
                    cmd.connection_id,
                    cursor_after=result.cursor.value,
                    discovered_count=len(result.documents),
                    enqueued_count=enqueued_count,
                    poll_interval_seconds=connection["poll_interval_seconds"],
                )
                return {"discovered": len(result.documents), "enqueued": enqueued_count}
            except Exception as exc:
                await repo.fail_watch_run(
                    conn,
                    run_id,
                    cmd.connection_id,
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                )
                raise

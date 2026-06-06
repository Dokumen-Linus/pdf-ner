from __future__ import annotations

import time
from typing import Any

from app.shared.infrastructure.db import get_pool
from app.shared.infrastructure.event_publisher import publish_source_integration_event
from app.shared.infrastructure.redis import RedisLock

from ..domain.services import extraction_task_args
from ..infrastructure import provider_registry
from ..infrastructure import repositories as repo
from .commands import DispatchDueWatchers, PollSourceConnection


async def handle_dispatch_due_watchers(cmd: DispatchDueWatchers) -> dict:
    started_at = time.perf_counter()
    from ..tasks import poll_source_connection_task

    pool = await get_pool()
    async with pool.acquire() as conn:
        connection_ids = await repo.fetch_due_connection_ids(conn, cmd.limit)

    for connection_id in connection_ids:
        poll_source_connection_task.delay(str(connection_id))

    await publish_source_integration_event(
        event_name="workers.source_watchers.dispatch_due",
        status="succeeded",
        source="source_watchers.dispatch_due_watchers",
        metadata={"limit": cmd.limit, "dispatched_count": len(connection_ids)},
        started_at=started_at,
    )
    return {"dispatched": len(connection_ids)}


async def handle_poll_source_connection(cmd: PollSourceConnection, task: Any | None = None) -> dict:
    from app.domains.ner_workflows.tasks import process_document_source_task

    started_at = time.perf_counter()
    task_id = getattr(getattr(task, "request", None), "id", None)
    async with RedisLock(f"watch:{cmd.connection_id}", ttl=900) as lock:
        if not lock.acquired:
            await publish_source_integration_event(
                event_name="workers.source_watchers.poll.skipped",
                status="skipped",
                source="source_watchers.poll_source_connection",
                resource_type="watcher",
                resource_id=str(cmd.connection_id),
                task_id=task_id,
                metadata={"lock_acquired": False, "reason": "locked"},
                started_at=started_at,
            )
            return {"status": "skipped", "reason": "locked"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            run_id = None
            connection = None
            try:
                connection = await repo.fetch_connection(conn, cmd.connection_id)
                if connection is None:
                    raise LookupError(f"Source connection not found: {cmd.connection_id}")

                cursor_before = await repo.fetch_cursor(conn, cmd.connection_id)
                run_id = await repo.insert_watch_run(conn, cmd.connection_id, cursor_before)
                connection["watcher_run_id"] = run_id
                await publish_source_integration_event(
                    event_name="workers.source_watchers.poll.started",
                    status="started",
                    source="source_watchers.poll_source_connection",
                    project_id=connection["project_id"],
                    resource_type="watcher",
                    resource_id=str(cmd.connection_id),
                    task_id=task_id,
                    metadata={
                        "provider": connection["provider"],
                        "source_connection_id": str(connection["source_connection_id"]),
                        "source_id": str(connection["source_id"]),
                        "ner_workflow_id": str(connection["ner_workflow_id"]),
                        "watcher_run_id": run_id,
                        "cursor_before_present": cursor_before is not None,
                        "lock_acquired": True,
                    },
                    started_at=started_at,
                )
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
                await publish_source_integration_event(
                    event_name="workers.source_watchers.poll.succeeded",
                    status="succeeded",
                    source="source_watchers.poll_source_connection",
                    project_id=connection["project_id"],
                    resource_type="watcher",
                    resource_id=str(cmd.connection_id),
                    task_id=task_id,
                    metadata={
                        "provider": connection["provider"],
                        "source_connection_id": str(connection["source_connection_id"]),
                        "source_id": str(connection["source_id"]),
                        "ner_workflow_id": str(connection["ner_workflow_id"]),
                        "watcher_run_id": run_id,
                        "cursor_before_present": cursor_before is not None,
                        "cursor_after_present": result.cursor.value is not None,
                        "discovered_count": len(result.documents),
                        "enqueued_count": enqueued_count,
                        "poll_interval_seconds": connection["poll_interval_seconds"],
                        "lock_acquired": True,
                    },
                    started_at=started_at,
                )
                return {"discovered": len(result.documents), "enqueued": enqueued_count}
            except Exception as exc:
                if run_id is not None:
                    await repo.fail_watch_run(
                        conn,
                        run_id,
                        cmd.connection_id,
                        error_type=type(exc).__name__,
                        error_message=str(exc),
                    )
                await publish_source_integration_event(
                    event_name="workers.source_watchers.poll.failed",
                    status="failed",
                    source="source_watchers.poll_source_connection",
                    project_id=connection["project_id"] if connection else None,
                    resource_type="watcher",
                    resource_id=str(cmd.connection_id),
                    task_id=task_id,
                    metadata={
                        "failure_stage": "provider_discovery",
                        "provider": connection["provider"] if connection else None,
                        "watcher_run_id": run_id,
                        "lock_acquired": True,
                    },
                    error=exc,
                    started_at=started_at,
                )
                raise

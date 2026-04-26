from uuid import UUID

import anyio

from app.main import app

from .application.commands import DispatchDueWatchers, PollSourceConnection
from .application.handlers import handle_dispatch_due_watchers, handle_poll_source_connection


@app.task(name="source_watchers.dispatch_due_watchers")
def dispatch_due_watchers_task(limit: int = 100) -> dict:
    return anyio.run(handle_dispatch_due_watchers, DispatchDueWatchers(limit=limit))


@app.task(bind=True, name="source_watchers.poll_source_connection", max_retries=2)
def poll_source_connection_task(self, connection_id: str) -> dict:
    cmd = PollSourceConnection(connection_id=UUID(connection_id))
    try:
        return anyio.run(handle_poll_source_connection, cmd)
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60) from exc

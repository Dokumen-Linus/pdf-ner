from uuid import UUID

import anyio

from app.main import app

from .application.commands import (
    CreateListener,
    DisableListener,
    HandleListenerEvent,
    RenewListener,
)
from .application.handlers import (
    handle_create_listener,
    handle_disable_listener,
    handle_listener_event,
    handle_renew_listener,
)


@app.task(bind=True, name="source_listeners.create_listener", max_retries=2)
def create_listener_task(self, connection_id: str) -> dict:
    try:
        return anyio.run(handle_create_listener, CreateListener(UUID(connection_id)))
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60) from exc


@app.task(bind=True, name="source_listeners.renew_listener", max_retries=2)
def renew_listener_task(self, listener_subscription_id: str) -> dict:
    try:
        return anyio.run(handle_renew_listener, RenewListener(UUID(listener_subscription_id)))
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60) from exc


@app.task(bind=True, name="source_listeners.disable_listener", max_retries=2)
def disable_listener_task(self, listener_subscription_id: str) -> dict:
    try:
        return anyio.run(handle_disable_listener, DisableListener(UUID(listener_subscription_id)))
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60) from exc


@app.task(bind=True, name="source_listeners.handle_listener_event", max_retries=2)
def handle_listener_event_task(
    self,
    listener_subscription_id: str,
    event_payload: dict,
) -> dict:
    try:
        return anyio.run(
            handle_listener_event,
            HandleListenerEvent(UUID(listener_subscription_id), event_payload),
        )
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60) from exc

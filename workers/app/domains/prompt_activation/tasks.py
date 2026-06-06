from __future__ import annotations

import logging
import time
from uuid import UUID

import anyio

from app.main import app
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync

from .application.commands import ActivateProjectPrompt
from .application.handlers import handle_activate_project_prompt

logger = logging.getLogger(__name__)


@app.task(bind=True, name="prompt_activation.activate_project_prompt", max_retries=2)
def activate_project_prompt_task(self, project_id: str, prompt_id: str) -> dict:
    started_at = time.perf_counter()
    cmd = ActivateProjectPrompt(project_id=UUID(project_id), prompt_id=UUID(prompt_id))
    metadata = {"prompt_id": str(cmd.prompt_id)}
    publish_task_lifecycle_event_sync(
        status="started",
        task=self,
        task_name="prompt_activation.activate_project_prompt",
        project_id=cmd.project_id,
        resource_type="project",
        resource_id=str(cmd.project_id),
        metadata=metadata,
        started_at=started_at,
    )
    try:
        result = anyio.run(handle_activate_project_prompt, cmd)
        publish_task_lifecycle_event_sync(
            status="succeeded",
            task=self,
            task_name="prompt_activation.activate_project_prompt",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={
                **metadata,
                "full_text_materialized": result.get("full_text_materialized"),
            },
            started_at=started_at,
        )
        return result
    except (LookupError, ValueError) as exc:
        publish_task_lifecycle_event_sync(
            status="failed",
            task=self,
            task_name="prompt_activation.activate_project_prompt",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata=metadata,
            error=exc,
            started_at=started_at,
        )
        raise
    except Exception as exc:
        logger.error("Prompt activation failed: %s", exc, exc_info=True)
        publish_task_lifecycle_event_sync(
            status="retrying",
            task=self,
            task_name="prompt_activation.activate_project_prompt",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={**metadata, "countdown": 60},
            error=exc,
            started_at=started_at,
        )
        raise self.retry(exc=exc, countdown=60) from exc

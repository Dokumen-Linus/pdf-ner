import logging
import time
from uuid import UUID

import anyio

from app.main import app
from app.shared.infrastructure.event_publisher import publish_task_lifecycle_event_sync

from .application.commands import EvaluateChatModels
from .application.handlers import handle_evaluate_chat_models

logger = logging.getLogger(__name__)


@app.task(bind=True, name="chat_model_eval.evaluate_models", max_retries=2)
def evaluate_chat_models_task(
    self,
    project_id: str,
    pdf_ids: list[str],
    chat_model_ids: list[str],
    beta: float = 1.0,
) -> dict:
    started_at = time.perf_counter()
    cmd = EvaluateChatModels(
        project_id=UUID(project_id),
        pdf_ids=[UUID(pdf_id) for pdf_id in pdf_ids],
        chat_model_ids=chat_model_ids,
        beta=float(beta),
    )
    metadata = {
        "pdf_count": len(cmd.pdf_ids),
        "chat_model_ids": cmd.chat_model_ids,
        "beta": cmd.beta,
    }
    publish_task_lifecycle_event_sync(
        status="started",
        task=self,
        task_name="chat_model_eval.evaluate_models",
        project_id=cmd.project_id,
        resource_type="project",
        resource_id=str(cmd.project_id),
        metadata=metadata,
        started_at=started_at,
    )
    try:
        result = anyio.run(handle_evaluate_chat_models, cmd, self)
        publish_task_lifecycle_event_sync(
            status="succeeded",
            task=self,
            task_name="chat_model_eval.evaluate_models",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={
                **metadata,
                "chat_model_eval_run_id": result.get("chat_model_eval_run_id"),
                "best_model_id": result.get("best_model_id"),
                "best_f": result.get("best_f"),
                "accuracy_score": result.get("accuracy_score"),
                "iteration_count": len(result.get("iterations") or []),
            },
            started_at=started_at,
        )
        return result
    except (LookupError, ValueError) as exc:
        publish_task_lifecycle_event_sync(
            status="failed",
            task=self,
            task_name="chat_model_eval.evaluate_models",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata=metadata,
            error=exc,
            started_at=started_at,
        )
        raise
    except Exception as exc:
        logger.error("Chat model evaluation failed: %s", exc, exc_info=True)
        publish_task_lifecycle_event_sync(
            status="retrying",
            task=self,
            task_name="chat_model_eval.evaluate_models",
            project_id=cmd.project_id,
            resource_type="project",
            resource_id=str(cmd.project_id),
            metadata={**metadata, "countdown": 60},
            error=exc,
            started_at=started_at,
        )
        raise self.retry(exc=exc, countdown=60) from exc

import logging
from uuid import UUID

import anyio

from app.main import app

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
    cmd = EvaluateChatModels(
        project_id=UUID(project_id),
        pdf_ids=[UUID(pdf_id) for pdf_id in pdf_ids],
        chat_model_ids=chat_model_ids,
        beta=float(beta),
    )
    try:
        return anyio.run(handle_evaluate_chat_models, cmd, self)
    except (LookupError, ValueError):
        raise
    except Exception as exc:
        logger.error("Chat model evaluation failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60) from exc

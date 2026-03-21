import logging

import asyncpg
from fastapi import APIRouter, Depends

from app.core.db import get_conn
from app.core.dependencies import get_llm_clients

from . import service
from .schemas import ExtractEntitiesRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm-ner", tags=["llm-ner"])


@router.post("/extract")
async def extract_entities(
    request_data: ExtractEntitiesRequest,
    conn: asyncpg.Connection = Depends(get_conn),
    clients: dict = Depends(get_llm_clients),
):
    logger.info(
        "POST /llm-ner/extract: project_id=%s, provider=%s, model=%s",
        request_data.project_id,
        request_data.provider,
        request_data.model,
    )
    result = await service.extract_entities(conn, clients, request_data)
    logger.info("POST /llm-ner/extract completed: prompt_id=%s", result["prompt_id"])
    return result

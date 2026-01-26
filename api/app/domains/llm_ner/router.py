import asyncpg
from fastapi import APIRouter, Depends

from app.core.db import get_conn
from app.core.dependencies import get_llm_clients

from . import service
from .schemas import ExtractEntitiesRequest

router = APIRouter(prefix="/llm-ner", tags=["llm-ner"])


@router.post("/extract")
async def extract_entities(
    request_data: ExtractEntitiesRequest,
    conn: asyncpg.Connection = Depends(get_conn),
    clients: dict = Depends(get_llm_clients),
):
    return await service.extract_entities(conn, clients, request_data)

from fastapi import APIRouter

from .domains.llm_ner.router import router as llm_ner_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(llm_ner_router)

from fastapi import APIRouter

from .domains.llm_ner.router import router as llm_ner_router
# from .domains.new_domain.router import router as new_domain_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(llm_ner_router)
# api_router.include_router(new_domain_router)
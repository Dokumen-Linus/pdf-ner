from fastapi import APIRouter

from .domains.extract_text.router import router as extract_text_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(extract_text_router)

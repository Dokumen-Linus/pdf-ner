from fastapi import APIRouter, Depends

from .core.dependencies import verify_api_key
from .domains.billing.router import router as billing_router
from .domains.llm_ner.router import router as llm_ner_router
from .domains.pdf_storage.router import router as pdf_storage_router
from .domains.pdf_utils.router import router as pdf_utils_router

api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(verify_api_key)])

api_router.include_router(llm_ner_router)
api_router.include_router(pdf_utils_router)
api_router.include_router(pdf_storage_router)
api_router.include_router(billing_router)

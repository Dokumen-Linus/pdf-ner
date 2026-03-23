from fastapi import APIRouter, Depends

from .core.dependencies import verify_api_key
from .domains.llm_ner.router import router as llm_ner_router
from .domains.pdf_text_extract.router import router as pdf_text_extract_router
from .domains.pdf_utils.router import router as pdf_utils_router

# from .domains.new_domain.router import router as new_domain_router

api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(verify_api_key)])

api_router.include_router(llm_ner_router)
api_router.include_router(pdf_text_extract_router)
api_router.include_router(pdf_utils_router)
# api_router.include_router(new_domain_router)

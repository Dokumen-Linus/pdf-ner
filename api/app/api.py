from fastapi import APIRouter, Depends

from .core.dependencies import verify_api_key
from .domains.avatar_storage.router import router as avatar_storage_router
from .domains.pdf_storage.router import router as pdf_storage_router
from .domains.pdf_utils.router import router as pdf_utils_router
from .domains.uat_worker_dispatch.router import router as uat_worker_dispatch_router
from .domains.worker_dispatch.router import router as worker_dispatch_router

api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(verify_api_key)])

api_router.include_router(worker_dispatch_router)
api_router.include_router(uat_worker_dispatch_router)
api_router.include_router(pdf_utils_router)
api_router.include_router(pdf_storage_router)
api_router.include_router(avatar_storage_router)

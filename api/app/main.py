from fastapi import FastAPI

from .api import api_router
from .core.config import settings
from .core.lifespan import lifespan

app = FastAPI(
    lifespan=lifespan,
    title="dokumen_ai_backend",
    version="0.0.0",
    description="Dokumen AI Backend",
    docs_url=None if settings.isproduction else "/docs",
    redoc_url=None if settings.isproduction else "/redoc",
    openapi_url=None if settings.isproduction else "/openapi.json",
)

app.include_router(api_router)

# do i need another line to set settings?
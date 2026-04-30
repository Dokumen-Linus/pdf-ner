from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .api import api_router
from .core.config import settings
from .core.exceptions import register_exception_handlers
from .core.lifespan import lifespan
from .core.logging import telemetry_router
from .core.middleware import RequestIDMiddleware, RequestLoggingMiddleware

app = FastAPI(
    lifespan=lifespan,
    title="dokumen_ai_backend",
    version="0.0.0",
    description="Dokumen AI FastAPI",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

register_exception_handlers(app)

# Middleware executes outermost-first: CORS → TrustedHost → RequestID → RequestLogging
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

app.include_router(api_router)
app.include_router(telemetry_router)

from fastapi import FastAPI

from .router import router

app = FastAPI(
    title="PDF Text Extract API",
    version="0.1.0",
    description="Standalone API for PDF text extraction endpoints",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(router)


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "PDF Text Extract API",
        "docs": "/docs",
        "endpoints": [
            "GET /pdf-text-extract/bookmarks",
            "POST /pdf-text-extract/search-text",
            "POST /pdf-text-extract/highlight-phrases",
        ]
    }

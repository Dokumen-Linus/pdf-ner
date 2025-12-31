from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from .schemas import PDFTextResponse
from .service import PDFService
from .repository import PDFRepository
from backend.db.client import get_pool  # your asyncpg pool dependency
from backend.core.config import settings

router = APIRouter(prefix="/pdfs", tags=["pdfs"])

def get_pdf_service(
    pool = Depends(get_pool),
) -> PDFService:
    repo = PDFRepository(pool)
    return PDFService(
        repo=repo,
        s3_bucket=settings.S3_BUCKET,
    )

@router.get("/{pdf_id}/text", response_model=PDFTextResponse)
async def extract_pdf_text(
    pdf_id: UUID,
    service: PDFService = Depends(get_pdf_service),
):
    try:
        return await service.extract_text(pdf_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="PDF not found")

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from app.db.client import get_pool

from .repository import TemplateRepository
from .schemas import TemplateTextResponse
from .service import TemplateService

router = APIRouter(prefix="/templates", tags=["templates"])


def get_template_service(
    pool=Depends(get_pool),
) -> TemplateService:
    repo = TemplateRepository(pool)
    return TemplateService(
        repo=repo,
        _props={},
    )


@router.get("/{id}/name", response_model=TemplateTextResponse)
async def get_name(
    id: UUID,
    service: TemplateService = Depends(get_template_service),
):
    try:
        return await service.get_name(id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail="template not found") from e

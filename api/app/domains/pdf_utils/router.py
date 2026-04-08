import asyncpg
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.db import get_conn

from . import service
from .schemas import HighlightRequest

router = APIRouter(prefix="/pdf-utils", tags=["pdf-utils"])


@router.post("/highlight")
async def highlight_phrases(
    request: HighlightRequest,
    conn: asyncpg.Connection = Depends(get_conn),
):
    try:
        return await service.highlight(conn, request)
    except LookupError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        ) from None
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"S3 error: {e}",
        ) from None

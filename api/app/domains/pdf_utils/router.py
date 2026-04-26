import asyncpg
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, status
from pdf_ocr_utils.exceptions import OcrExecutionError

from app.core.db import get_conn

from . import service
from .schemas import ExtractTextRequest, HighlightRequest

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


@router.post("/extract-text")
async def extract_text(
    request: ExtractTextRequest,
    conn: asyncpg.Connection = Depends(get_conn),
):
    try:
        return await service.extract_text(conn, request)
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
    except OcrExecutionError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OCR error: {e}",
        ) from None

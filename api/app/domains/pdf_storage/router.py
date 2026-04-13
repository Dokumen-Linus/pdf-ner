from urllib.parse import unquote
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.db import get_conn
from app.domains.pdf_storage import service
from app.domains.pdf_storage.schemas import CreateBucketRequest

router = APIRouter(prefix="/pdf-storage", tags=["pdf_storage"])

MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/buckets")
async def create_bucket(
    request: CreateBucketRequest,
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await service.create_bucket(conn, request)


@router.post("/pdfs")
async def upload_pdf(
    request: Request,
    project_id: UUID = Query(...),
    bucket_id: UUID = Query(...),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Stream a PDF upload into S3 without buffering the full file in memory.

    Contract:
      * query param  project_id : UUID
      * query param  bucket_id  : UUID
      * header       X-Filename : url-encoded filename (optional; defaults to "upload.pdf")
      * header       Content-Type: application/pdf
      * body         raw PDF bytes (not multipart)

    Size is enforced twice:
      1. Against Content-Length up front (cheap; rejects lying-large requests early).
      2. By counting bytes during the stream (source of truth; catches missing/lying Content-Length).
    """
    content_type = (request.headers.get("content-type") or "").lower()
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Content-Type must be application/pdf")

    content_length_header = request.headers.get("content-length")
    if content_length_header is not None:
        try:
            content_length = int(content_length_header)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length header")
        if content_length > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    raw_filename = request.headers.get("x-filename") or "upload.pdf"
    filename = unquote(raw_filename)

    return await service.upload_pdf_stream(conn, bucket_id, project_id, filename, request)

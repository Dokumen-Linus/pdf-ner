from urllib.parse import unquote
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

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


@router.get("/pdfs/{pdf_id}/url")
async def get_pdf_url(
    pdf_id: UUID,
    x_user_id: UUID | None = Header(default=None, alias="X-User-Id"),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Return a presigned S3 GET URL the browser can fetch directly.

    Internal-only route: the web server authenticates the browser session,
    forwards the caller via X-User-Id, and this route re-checks ownership
    before minting the signed URL.
    """
    if x_user_id is None:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    return await service.generate_pdf_get_url(conn, pdf_id, x_user_id)


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
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid Content-Length header") from e
        if content_length > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    raw_filename = request.headers.get("x-filename") or "upload.pdf"
    filename = unquote(raw_filename)

    return await service.upload_pdf_stream(conn, bucket_id, project_id, filename, request)

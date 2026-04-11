from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

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
    file: UploadFile = File(...),
    project_id: UUID = Form(...),
    bucket_id: UUID = Form(...),
    conn: asyncpg.Connection = Depends(get_conn),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")
    return await service.upload_pdf(conn, bucket_id, project_id, file.filename or "upload.pdf", file_bytes)

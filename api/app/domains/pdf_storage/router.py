import time
from urllib.parse import unquote
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from app.core.db import get_conn
from app.domains.pdf_storage import service
from app.domains.pdf_storage.schemas import CreateBucketRequest
from app.domains.shared.schemas import MonitoringEventInput
from app.domains.shared.service import (
    error_fields,
    monotonic_ms,
    record_monitoring_event,
    request_context,
    safe_upload_metadata,
)

router = APIRouter(prefix="/pdf-storage", tags=["pdf_storage"])

MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/buckets")
async def create_bucket(
    raw_request: Request,
    request: CreateBucketRequest,
    conn: asyncpg.Connection = Depends(get_conn),
):
    started_at = time.perf_counter()
    metadata = {
        "bucket_name": request.name,
        "region": request.region,
        "has_endpoint_url": request.endpoint_url is not None,
    }
    try:
        result = await service.create_bucket(conn, request)
    except Exception as exc:
        await _record_storage_event(
            conn,
            raw_request,
            event_name="api.storage.bucket.create",
            status="failure",
            operation_type="mutation",
            resource_type="bucket",
            actor_user_id=request.owner_user_id,
            organization_id=request.owner_org_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_storage_event(
        conn,
        raw_request,
        event_name="api.storage.bucket.create",
        status="success",
        operation_type="mutation",
        resource_type="bucket",
        resource_id=result["bucket_id"],
        actor_user_id=request.owner_user_id,
        organization_id=request.owner_org_id,
        started_at=started_at,
        metadata={**metadata, "lifecycle_applied": result["lifecycle_applied"]},
    )
    return result


@router.get("/pdfs/{pdf_id}/url")
async def get_pdf_url(
    request: Request,
    pdf_id: UUID,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Return a presigned S3 GET URL the browser can fetch directly.

    Internal-only route: the web server authenticates the browser session,
    forwards the caller via X-User-Id, and this route re-checks ownership
    before minting the signed URL.
    """
    started_at = time.perf_counter()
    metadata = {"expires_in": service.PRESIGNED_URL_TTL_SECONDS}
    try:
        if x_user_id is None:
            raise HTTPException(status_code=401, detail="Missing X-User-Id header")
        return await service.generate_pdf_get_url(conn, pdf_id, x_user_id)
    except Exception as exc:
        await _record_storage_event(
            conn,
            request,
            event_name="api.storage.pdf.presigned_url",
            status="failure",
            operation_type="read",
            resource_type="pdf",
            resource_id=str(pdf_id),
            actor_user_id=x_user_id,
            started_at=started_at,
            metadata={**metadata, "failure_stage": _pdf_url_failure_stage(exc)},
            error=exc,
        )
        raise


@router.post("/pdfs")
async def upload_pdf(
    request: Request,
    project_id: UUID = Query(...),
    bucket_id: UUID = Query(...),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
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
    started_at = time.perf_counter()
    raw_filename = request.headers.get("x-filename") or "upload.pdf"
    filename = unquote(raw_filename)
    metadata = {
        **safe_upload_metadata(request, filename=filename),
        "bucket_id": str(bucket_id),
        "project_id": str(project_id),
    }
    try:
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

        result = await service.upload_pdf_stream(
            conn, bucket_id, project_id, filename, request, uploaded_by_user_id=x_user_id
        )
    except Exception as exc:
        await _record_storage_event(
            conn,
            request,
            event_name="api.storage.pdf.upload",
            status="failure",
            operation_type="mutation",
            project_id=project_id,
            resource_type="pdf",
            actor_user_id=x_user_id,
            started_at=started_at,
            metadata=metadata,
            error=exc,
        )
        raise

    await _record_storage_event(
        conn,
        request,
        event_name="api.storage.pdf.upload",
        status="success",
        operation_type="mutation",
        project_id=project_id,
        resource_type="pdf",
        resource_id=result["pdf_id"],
        actor_user_id=x_user_id,
        started_at=started_at,
        metadata={**metadata, **result},
    )
    return result


async def _record_storage_event(
    conn: asyncpg.Connection,
    request: Request,
    *,
    event_name: str,
    status: str,
    operation_type: str,
    started_at: float,
    metadata: dict,
    actor_user_id: str | None = None,
    organization_id: str | None = None,
    project_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    error: Exception | None = None,
) -> None:
    context = request_context(request)
    error_data = error_fields(error) if error is not None else {}
    await record_monitoring_event(
        conn,
        MonitoringEventInput(
            event_name=event_name,
            event_kind="storage",
            operation_type=operation_type,
            source="api.pdf_storage",
            status=status,
            actor_user_id=actor_user_id,
            organization_id=organization_id,
            project_id=project_id,
            resource_type=resource_type,
            resource_id=resource_id,
            duration_ms=monotonic_ms(started_at),
            metadata=metadata,
            raw_error_payload=metadata if error is not None else None,
            **context,
            **error_data,
        ),
    )


def _pdf_url_failure_stage(error: Exception) -> str:
    if isinstance(error, HTTPException):
        if error.status_code == 401:
            return "missing_user_header"
        if error.status_code == 404:
            return "pdf_not_found"
        if error.status_code == 403:
            return "owner_mismatch"
        if error.status_code == 500:
            return "bucket_missing"
        if error.status_code == 502:
            return "s3_signing_failed"
    return "unknown"

import logging
import re
from uuid import UUID, uuid4

import anyio
import asyncpg
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, Request

from app.domains.pdf_storage import repository
from app.domains.pdf_storage.schemas import CreateBucketRequest
from app.domains.shared.repository import fetch_bucket_by_id
from app.domains.shared.schemas import MonitoringEventInput
from app.domains.shared.service import (
    error_fields,
    record_monitoring_event,
    request_context,
    safe_upload_metadata,
)

logger = logging.getLogger(__name__)

# S3 multipart upload parameters.
# S3 requires every part except the last to be >= 5 MiB. We use exactly 5 MiB
# so a 50 MB file splits into ten parts (memory footprint: one 5 MiB buffer).
_S3_PART_SIZE = 5 * 1024 * 1024
_MAX_PDF_SIZE = 50 * 1024 * 1024

# Safety net for orphan multipart uploads: if the in-request abort_multipart_upload
# call fails (network blip, process crash), S3 keeps the uploaded parts forever.
# A bucket-level lifecycle rule auto-aborts anything still in-progress after N days.
# PDF uploads are single-HTTP-request streams capped at 50 MB — 24 h is far outside
# any legitimate upload duration, so 1 day minimizes wasted storage.
_INCOMPLETE_MULTIPART_ABORT_DAYS = 1
_LIFECYCLE_RULE_ID = "abort-incomplete-multipart-uploads"


async def _apply_private_encrypted_bucket_defaults(s3, bucket_name: str) -> None:
    await anyio.to_thread.run_sync(
        lambda: s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            },
        )
    )
    await anyio.to_thread.run_sync(
        lambda: s3.put_bucket_encryption(
            Bucket=bucket_name,
            ServerSideEncryptionConfiguration={
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256",
                        }
                    }
                ]
            },
        )
    )


async def _apply_incomplete_multipart_lifecycle(s3, bucket_name: str) -> bool:
    """Best-effort: install a lifecycle rule that auto-aborts orphan multiparts.

    Returns True if the rule was applied, False if S3 rejected the call
    (e.g. MinIO's NotImplemented). Failure here does not fail bucket creation —
    the bucket itself is usable; the rule is defense-in-depth.
    """
    config = {
        "Rules": [
            {
                "ID": _LIFECYCLE_RULE_ID,
                "Status": "Enabled",
                "Filter": {"Prefix": ""},
                "AbortIncompleteMultipartUpload": {
                    "DaysAfterInitiation": _INCOMPLETE_MULTIPART_ABORT_DAYS
                },
            }
        ]
    }
    try:
        await anyio.to_thread.run_sync(
            lambda: s3.put_bucket_lifecycle_configuration(
                Bucket=bucket_name, LifecycleConfiguration=config
            )
        )
        return True
    except ClientError:
        logger.exception(
            "Failed to apply incomplete-multipart lifecycle rule to bucket %s", bucket_name
        )
        return False


async def create_bucket(conn: asyncpg.Connection, request: CreateBucketRequest) -> dict:
    # 1. Insert DB row first (catches duplicate names early)
    try:
        bucket_id = await repository.insert_bucket(
            conn,
            request.name,
            request.region,
            request.endpoint_url,
            request.owner_user_id,
            request.owner_org_id,
        )
    except asyncpg.UniqueViolationError as e:
        raise HTTPException(
            status_code=409, detail=f"Bucket '{request.name}' already registered"
        ) from e

    # 2. Create S3 bucket
    s3_kwargs = {"region_name": request.region}
    if request.endpoint_url:
        s3_kwargs["endpoint_url"] = request.endpoint_url
    s3 = boto3.client("s3", **s3_kwargs)

    def _create():
        try:
            if request.region == "us-east-1":
                s3.create_bucket(Bucket=request.name)
            else:
                s3.create_bucket(
                    Bucket=request.name,
                    CreateBucketConfiguration={"LocationConstraint": request.region},
                )
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "BucketAlreadyOwnedByYou":
                s3.head_bucket(Bucket=request.name)
            else:
                raise

    try:
        await anyio.to_thread.run_sync(_create)
        await _apply_private_encrypted_bucket_defaults(s3, request.name)
    except ClientError as e:
        # Rollback DB row on S3 failure
        await repository.delete_bucket(conn, bucket_id)
        raise HTTPException(
            status_code=502, detail=f"S3 error: {e.response['Error']['Message']}"
        ) from e

    # Install the orphan-multipart safety net. Idempotent on S3, so it's safe to
    # re-apply on the BucketAlreadyOwnedByYou path (which lands here too).
    lifecycle_applied = await _apply_incomplete_multipart_lifecycle(s3, request.name)

    return {
        "bucket_id": str(bucket_id),
        "name": request.name,
        "lifecycle_applied": lifecycle_applied,
    }


def _sanitize_filename(filename: str) -> str:
    # Strip path separators, collapse control chars, drop dangerous punctuation.
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", filename)
    safe = safe.strip(". ")
    return safe or "upload.pdf"


def _build_s3_client(bucket: asyncpg.Record):
    s3_kwargs = {"region_name": bucket["region"]}
    if bucket["endpoint_url"]:
        s3_kwargs["endpoint_url"] = bucket["endpoint_url"]
    return boto3.client("s3", **s3_kwargs)


_PRESIGNED_URL_TTL_SECONDS = 3600  # 1 hour — balances cache-friendliness with security
PRESIGNED_URL_TTL_SECONDS = _PRESIGNED_URL_TTL_SECONDS


async def generate_pdf_get_url(conn: asyncpg.Connection, pdf_id: UUID, user_id: str) -> dict:
    """Return a time-limited S3 GET URL the browser can fetch directly.

    Credentials never leave the API tier. The AWS SDK resolves them from the
    runtime environment, normally the EC2 instance profile in production.
    """
    pdf = await repository.fetch_pdf_by_id(conn, pdf_id)
    if pdf is None:
        raise HTTPException(status_code=404, detail="PDF not found")
    try:
        owner_user_id = pdf["owner_user_id"]
    except KeyError:
        owner_user_id = str(pdf["owner_id"])
    if owner_user_id != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this PDF")

    bucket = await fetch_bucket_by_id(conn, pdf["bucket_id"])
    if bucket is None:
        raise HTTPException(status_code=500, detail="PDF bucket missing")

    s3 = _build_s3_client(bucket)
    bucket_name = bucket["name"]
    key = pdf["filepath"]

    def _sign() -> str:
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": key},
            ExpiresIn=_PRESIGNED_URL_TTL_SECONDS,
        )

    try:
        url = await anyio.to_thread.run_sync(_sign)
    except ClientError as e:
        raise HTTPException(
            status_code=502, detail=f"S3 error: {e.response['Error']['Message']}"
        ) from e

    return {"url": url, "expires_in": _PRESIGNED_URL_TTL_SECONDS, "pdf_id": str(pdf_id)}


async def upload_pdf_stream(
    conn: asyncpg.Connection,
    bucket_id: UUID,
    project_id: UUID,
    filename: str,
    request: Request,
    uploaded_by_user_id: str | None = None,
) -> dict:
    """Stream the request body into S3 using multipart upload.

    Memory footprint: one `_S3_PART_SIZE` (5 MiB) buffer per concurrent request.
    Byte counting during the stream is authoritative for the 50 MB size cap —
    Content-Length is pre-checked in the router but cannot be trusted alone.
    """
    bucket = await fetch_bucket_by_id(conn, bucket_id)
    if bucket is None:
        raise HTTPException(status_code=404, detail="Bucket not found")

    safe_name = _sanitize_filename(filename)
    filepath = f"{project_id}/{uuid4()}/{safe_name}"

    # Insert DB rows first so a successful S3 upload never lacks a matching row.
    pdf_id = await repository.insert_pdf(conn, project_id, filepath, uploaded_by_user_id)

    s3 = _build_s3_client(bucket)
    bucket_name = bucket["name"]

    # Initiate S3 multipart upload. From here on, every error path MUST call
    # abort_multipart_upload and roll back the DB rows.
    try:
        init = await anyio.to_thread.run_sync(
            lambda: s3.create_multipart_upload(
                Bucket=bucket_name, Key=filepath, ContentType="application/pdf"
            )
        )
    except ClientError as e:
        await repository.delete_pdf(conn, pdf_id)
        raise HTTPException(
            status_code=502, detail=f"S3 error: {e.response['Error']['Message']}"
        ) from e

    upload_id = init["UploadId"]

    async def _abort_and_rollback():
        rollback_error: ClientError | None = None
        try:
            await anyio.to_thread.run_sync(
                lambda: s3.abort_multipart_upload(
                    Bucket=bucket_name, Key=filepath, UploadId=upload_id
                )
            )
        except ClientError as exc:
            # Best-effort abort; orphaned parts expire per bucket lifecycle.
            rollback_error = exc
            logger.exception("Failed to abort S3 multipart upload %s", upload_id)
        await repository.delete_pdf(conn, pdf_id)
        metadata = {
            **safe_upload_metadata(request, filename=filename),
            "bucket_id": str(bucket_id),
            "project_id": str(project_id),
            "pdf_id": str(pdf_id),
            "filepath": filepath,
            "rollback_action": "delete_pdf_and_abort_multipart",
            "abort_succeeded": rollback_error is None,
        }
        await record_monitoring_event(
            conn,
            MonitoringEventInput(
                event_name="api.storage.pdf.upload.rollback",
                event_kind="storage",
                operation_type="mutation",
                source="api.pdf_storage",
                status="failure" if rollback_error else "success",
                actor_user_id=uploaded_by_user_id,
                project_id=project_id,
                resource_type="pdf",
                resource_id=str(pdf_id),
                metadata=metadata,
                raw_error_payload=metadata if rollback_error else None,
                **request_context(request),
                **(error_fields(rollback_error) if rollback_error else {}),
            ),
        )

    parts: list[dict] = []
    part_number = 1
    total_bytes = 0
    buffer = bytearray()

    async def _upload_part(body: bytes, number: int) -> None:
        resp = await anyio.to_thread.run_sync(
            lambda: s3.upload_part(
                Bucket=bucket_name,
                Key=filepath,
                UploadId=upload_id,
                PartNumber=number,
                Body=body,
            )
        )
        parts.append({"PartNumber": number, "ETag": resp["ETag"]})

    try:
        async for chunk in request.stream():
            if not chunk:
                continue
            total_bytes += len(chunk)
            if total_bytes > _MAX_PDF_SIZE:
                raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")
            buffer.extend(chunk)
            # Flush full 5 MiB parts; keep remainder for the next iteration.
            while len(buffer) >= _S3_PART_SIZE:
                part_body = bytes(buffer[:_S3_PART_SIZE])
                del buffer[:_S3_PART_SIZE]
                await _upload_part(part_body, part_number)
                part_number += 1

        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="Request body is empty")

        # Flush the final partial part (S3 allows the last part to be <5 MiB).
        if buffer:
            await _upload_part(bytes(buffer), part_number)

        await anyio.to_thread.run_sync(
            lambda: s3.complete_multipart_upload(
                Bucket=bucket_name,
                Key=filepath,
                UploadId=upload_id,
                MultipartUpload={"Parts": parts},
            )
        )
    except HTTPException:
        await _abort_and_rollback()
        raise
    except ClientError as e:
        await _abort_and_rollback()
        raise HTTPException(
            status_code=502, detail=f"S3 error: {e.response['Error']['Message']}"
        ) from e
    except Exception:
        await _abort_and_rollback()
        raise

    return {"pdf_id": str(pdf_id), "filepath": filepath, "bucket_name": bucket_name}

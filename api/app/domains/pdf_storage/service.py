import logging
import re
from uuid import UUID, uuid4

import anyio
import asyncpg
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.domains.pdf_storage import repository
from app.domains.pdf_storage.schemas import CreateBucketRequest
from app.domains.shared.repository import fetch_bucket_by_id

logger = logging.getLogger(__name__)


async def create_bucket(conn: asyncpg.Connection, request: CreateBucketRequest) -> dict:
    # 1. Insert DB row first (catches duplicate names early)
    try:
        bucket_id = await repository.insert_bucket(
            conn,
            request.name,
            request.region,
            request.access_key_id,
            request.secret_access_key,
            request.endpoint_url,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=f"Bucket '{request.name}' already registered")

    # 2. Create S3 bucket
    s3_kwargs = {
        "aws_access_key_id": request.access_key_id,
        "aws_secret_access_key": request.secret_access_key,
        "region_name": request.region,
    }
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
    except ClientError as e:
        # Rollback DB row on S3 failure
        await repository.delete_bucket(conn, bucket_id)
        raise HTTPException(status_code=502, detail=f"S3 error: {e.response['Error']['Message']}")

    return {"bucket_id": str(bucket_id), "name": request.name}


async def upload_pdf(
    conn: asyncpg.Connection,
    bucket_id: UUID,
    project_id: UUID,
    filename: str,
    file_bytes: bytes,
) -> dict:
    bucket = await fetch_bucket_by_id(conn, bucket_id)
    if bucket is None:
        raise HTTPException(status_code=404, detail="Bucket not found")

    # Sanitize filename: strip path separators, collapse whitespace, remove control chars
    safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", filename)
    safe_name = safe_name.strip(". ")
    if not safe_name:
        safe_name = "upload.pdf"
    filepath = f"{project_id}/{uuid4()}/{safe_name}"

    # 1. Insert DB rows first
    pdf_id = await repository.insert_pdf(conn, project_id, bucket_id, filepath, safe_name)

    # 2. Upload to S3
    s3_kwargs = {
        "aws_access_key_id": bucket["access_key_id"],
        "aws_secret_access_key": bucket["secret_access_key"],
        "region_name": bucket["region"],
    }
    if bucket["endpoint_url"]:
        s3_kwargs["endpoint_url"] = bucket["endpoint_url"]
    s3 = boto3.client("s3", **s3_kwargs)

    def _upload():
        s3.put_object(
            Bucket=bucket["name"],
            Key=filepath,
            Body=file_bytes,
            ContentType="application/pdf",
        )

    try:
        await anyio.to_thread.run_sync(_upload)
    except ClientError as e:
        # Rollback DB rows on S3 failure
        await repository.delete_pdf(conn, pdf_id)
        raise HTTPException(status_code=502, detail=f"S3 error: {e.response['Error']['Message']}")

    return {"pdf_id": str(pdf_id), "filepath": filepath, "bucket_name": bucket["name"]}

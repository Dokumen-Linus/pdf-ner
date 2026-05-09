import re
from uuid import uuid4

import anyio
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.core.config import settings

_SANITIZE_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _sanitize_filename(filename: str) -> str:
    safe = _SANITIZE_RE.sub("_", filename)
    safe = safe.strip(". ")
    return safe or "avatar.jpg"


def _build_s3_client():
    kwargs: dict = {"region_name": settings.AVATARS_AWS_REGION}
    if settings.AVATARS_AWS_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.AVATARS_AWS_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


async def upload_avatar(filename: str, content_type: str, data: bytes) -> dict:
    safe = _sanitize_filename(filename)
    ext = safe.rsplit(".", 1)[-1] if "." in safe else "jpg"
    key = f"{uuid4()}.{ext}"

    s3 = _build_s3_client()
    try:
        await anyio.to_thread.run_sync(
            lambda: s3.put_object(
                Bucket=settings.AVATARS_S3_BUCKET_NAME,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        )
    except ClientError as e:
        raise HTTPException(
            status_code=502, detail=f"S3 error: {e.response['Error']['Message']}"
        ) from e

    if settings.AVATARS_AWS_ENDPOINT_URL:
        url = f"{settings.AVATARS_AWS_ENDPOINT_URL}/{settings.AVATARS_S3_BUCKET_NAME}/{key}"
    else:
        url = f"https://{settings.AVATARS_S3_BUCKET_NAME}.s3.{settings.AVATARS_AWS_REGION}.amazonaws.com/{key}"

    return {"avatar_url": url}

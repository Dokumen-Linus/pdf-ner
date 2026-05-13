import logging
from uuid import UUID

import anyio
import asyncpg
import boto3

from .repository import fetch_pdf_bucket_info

logger = logging.getLogger(__name__)


def make_s3_client(
    region: str,
    endpoint_url: str | None,
):
    """Create a boto3 S3 client using the runtime AWS credential provider chain."""
    kwargs = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("s3", **kwargs)


async def download_pdf_bytes(
    conn: asyncpg.Connection,
    pdf_id: UUID,
    project_id: UUID | None = None,
) -> tuple[bytes, str]:
    """Resolve bucket metadata for pdf_id from DB, download from S3.

    Returns (bytes, filepath).
    Raises LookupError if pdf not found.
    """
    if project_id is None:
        row = await fetch_pdf_bucket_info(conn, pdf_id)
    else:
        row = await fetch_pdf_bucket_info(conn, pdf_id, project_id)
    if row is None:
        raise LookupError(f"PDF {pdf_id} not found")

    s3 = make_s3_client(
        row["region"],
        row["endpoint_url"],
    )
    filepath = row["filepath"]
    bucket_name = row["bucket_name"]

    def _download():
        response = s3.get_object(Bucket=bucket_name, Key=filepath)
        return response["Body"].read()

    data = await anyio.to_thread.run_sync(_download)
    return data, filepath


async def upload_pdf_bytes(conn: asyncpg.Connection, pdf_id: UUID, data: bytes) -> None:
    """Upload bytes to the S3 bucket/filepath recorded for pdf_id."""
    row = await fetch_pdf_bucket_info(conn, pdf_id)
    if row is None:
        raise LookupError(f"PDF {pdf_id} not found")

    s3 = make_s3_client(
        row["region"],
        row["endpoint_url"],
    )

    def _upload():
        s3.put_object(Bucket=row["bucket_name"], Key=row["filepath"], Body=data)

    await anyio.to_thread.run_sync(_upload)

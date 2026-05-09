"""Tests for shared S3 infrastructure helpers."""

from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from app.shared.infrastructure.s3 import download_pdf_bytes, make_s3_client, upload_pdf_bytes

PDF_ID = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
BUCKET_ID = UUID("11111111-1111-1111-1111-111111111111")

_BUCKET_ROW = {
    "filepath": "uploads/sample.pdf",
    "bucket_name": "my-bucket",
    "region": "us-east-1",
    "endpoint_url": None,
}


class TestMakeS3Client:
    def test_returns_boto3_client(self):
        with patch("app.shared.infrastructure.s3.boto3.client") as mock_boto_client:
            client = make_s3_client(
                region="us-east-1",
                endpoint_url=None,
            )
            assert client == mock_boto_client.return_value

    def test_includes_endpoint_url(self):
        with patch("app.shared.infrastructure.s3.boto3.client") as mock_boto_client:
            make_s3_client(
                region="us-east-1",
                endpoint_url="http://localhost:9000",
            )
            call_kwargs = mock_boto_client.call_args[1]
            assert call_kwargs["endpoint_url"] == "http://localhost:9000"

    def test_omits_endpoint_url_when_none(self):
        with patch("app.shared.infrastructure.s3.boto3.client") as mock_boto_client:
            make_s3_client(
                region="us-east-1",
                endpoint_url=None,
            )
            call_kwargs = mock_boto_client.call_args[1]
            assert "endpoint_url" not in call_kwargs


class TestDownloadPdfBytes:
    @pytest.mark.anyio
    async def test_happy_path(self):
        conn = AsyncMock()

        with (
            patch(
                "app.shared.infrastructure.s3.fetch_pdf_bucket_info",
                return_value=_BUCKET_ROW,
            ) as mock_fetch,
            patch("app.shared.infrastructure.s3.anyio.to_thread.run_sync") as mock_run_sync,
        ):
            mock_run_sync.return_value = b"pdf bytes"
            result = await download_pdf_bytes(conn, PDF_ID)

        assert result == (b"pdf bytes", "uploads/sample.pdf")
        mock_fetch.assert_awaited_once_with(conn, PDF_ID)

    @pytest.mark.anyio
    async def test_raises_lookup_error_when_not_found(self):
        conn = AsyncMock()

        with patch(
            "app.shared.infrastructure.s3.fetch_pdf_bucket_info",
            return_value=None,
        ):
            with pytest.raises(LookupError, match=str(PDF_ID)):
                await download_pdf_bytes(conn, PDF_ID)

    @pytest.mark.anyio
    async def test_s3_error_propagates(self):
        from botocore.exceptions import ClientError

        conn = AsyncMock()

        client_error = ClientError(
            error_response={"Error": {"Code": "NoSuchKey", "Message": "Not found"}},
            operation_name="GetObject",
        )

        with (
            patch(
                "app.shared.infrastructure.s3.fetch_pdf_bucket_info",
                return_value=_BUCKET_ROW,
            ),
            patch("app.shared.infrastructure.s3.anyio.to_thread.run_sync") as mock_run_sync,
        ):
            mock_run_sync.side_effect = client_error
            with pytest.raises(ClientError):
                await download_pdf_bytes(conn, PDF_ID)


class TestUploadPdfBytes:
    @pytest.mark.anyio
    async def test_happy_path(self):
        conn = AsyncMock()

        with (
            patch(
                "app.shared.infrastructure.s3.fetch_pdf_bucket_info",
                return_value=_BUCKET_ROW,
            ) as mock_fetch,
            patch("app.shared.infrastructure.s3.anyio.to_thread.run_sync") as mock_run_sync,
        ):
            mock_run_sync.return_value = None
            await upload_pdf_bytes(conn, PDF_ID, b"pdf content")

        mock_run_sync.assert_called_once()
        mock_fetch.assert_awaited_once_with(conn, PDF_ID)

    @pytest.mark.anyio
    async def test_raises_lookup_error_when_not_found(self):
        conn = AsyncMock()

        with patch(
            "app.shared.infrastructure.s3.fetch_pdf_bucket_info",
            return_value=None,
        ):
            with pytest.raises(LookupError, match=str(PDF_ID)):
                await upload_pdf_bytes(conn, PDF_ID, b"data")

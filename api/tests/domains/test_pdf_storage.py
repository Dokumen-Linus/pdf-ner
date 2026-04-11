"""Tests for the pdf_storage domain (create_bucket and upload_pdf endpoints)."""

import os
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import asyncpg
import httpx
import pytest
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, FastAPI

from app.core.db import get_conn
from app.core.dependencies import verify_api_key
from app.core.exceptions import register_exception_handlers
from app.domains.pdf_storage.router import router as pdf_storage_router

_TEST_API_KEY: str = os.environ.get("API_KEY", "test-api-key")


def _make_client_error(code: str, message: str = "error") -> ClientError:
    return ClientError(
        error_response={"Error": {"Code": code, "Message": message}},
        operation_name="op",
    )


@pytest.fixture
async def storage_client(mock_conn, mock_redis):
    """httpx.AsyncClient wired to a minimal app that only has pdf_storage routes."""

    @asynccontextmanager
    async def _lifespan(application: FastAPI):
        application.state.redis = mock_redis
        yield

    app = FastAPI(lifespan=_lifespan)
    register_exception_handlers(app)

    async def _get_test_conn():
        yield mock_conn

    app.dependency_overrides[verify_api_key] = lambda: None
    app.dependency_overrides[get_conn] = _get_test_conn

    api_router = APIRouter(prefix="/api/v1", dependencies=[Depends(verify_api_key)])
    api_router.include_router(pdf_storage_router)
    app.include_router(api_router)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        headers={"X-API-Key": _TEST_API_KEY},
    ) as client:
        yield client


class TestCreateBucket:
    @pytest.mark.anyio
    async def test_happy_path(self, storage_client, mock_conn):
        """POST /buckets with valid credentials returns bucket_id and name."""
        bucket_id = uuid4()
        mock_s3 = MagicMock()
        mock_conn.fetchval = AsyncMock(return_value=bucket_id)

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/buckets",
                json={
                    "name": "my-test-bucket",
                    "region": "us-east-1",
                    "access_key_id": "AKIAIOSFODNN7EXAMPLE",
                    "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                },
            )

        assert response.status_code == 200
        body = response.json()
        assert body["bucket_id"] == str(bucket_id)
        assert body["name"] == "my-test-bucket"

    @pytest.mark.anyio
    async def test_s3_error_returns_502(self, storage_client, mock_conn):
        """A ClientError from S3 create_bucket propagates as 502 and rolls back DB."""
        bucket_id = uuid4()
        mock_conn.fetchval = AsyncMock(return_value=bucket_id)
        mock_conn.execute = AsyncMock()

        client_error = _make_client_error("InternalError", "S3 internal error")
        mock_s3 = MagicMock()
        mock_s3.create_bucket.side_effect = client_error

        # run_sync executes the closure directly so boto3 raises inside the try/except
        async def _run_sync_directly(fn, *args, **kwargs):
            fn()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
                side_effect=_run_sync_directly,
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/buckets",
                json={
                    "name": "my-test-bucket",
                    "region": "us-east-1",
                    "access_key_id": "key",
                    "secret_access_key": "secret",
                },
            )

        assert response.status_code == 502
        assert "S3 error" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_bucket_already_owned_succeeds(self, storage_client, mock_conn):
        """BucketAlreadyOwnedByYou triggers head_bucket and still returns 200."""
        bucket_id = uuid4()
        mock_conn.fetchval = AsyncMock(return_value=bucket_id)

        mock_s3 = MagicMock()
        already_owned_error = _make_client_error("BucketAlreadyOwnedByYou")
        mock_s3.create_bucket.side_effect = already_owned_error
        mock_s3.head_bucket.return_value = {}

        # Run the sync function directly (bypass anyio threading) by calling fn()
        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/buckets",
                json={
                    "name": "existing-bucket",
                    "region": "us-east-1",
                    "access_key_id": "key",
                    "secret_access_key": "secret",
                },
            )

        assert response.status_code == 200
        assert response.json()["name"] == "existing-bucket"
        mock_s3.head_bucket.assert_called_once_with(Bucket="existing-bucket")

    @pytest.mark.anyio
    async def test_missing_required_fields_returns_422(self, storage_client):
        """Omitting required fields returns 422 from Pydantic validation."""
        response = await storage_client.post(
            "/api/v1/pdf-storage/buckets",
            json={"name": "bucket"},  # missing access_key_id and secret_access_key
        )

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_non_us_east_1_region_uses_location_constraint(self, storage_client, mock_conn):
        """For non-us-east-1 regions, CreateBucketConfiguration is passed to S3."""
        bucket_id = uuid4()
        mock_conn.fetchval = AsyncMock(return_value=bucket_id)
        mock_s3 = MagicMock()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/buckets",
                json={
                    "name": "eu-bucket",
                    "region": "eu-west-1",
                    "access_key_id": "key",
                    "secret_access_key": "secret",
                },
            )

        assert response.status_code == 200
        mock_s3.create_bucket.assert_called_once_with(
            Bucket="eu-bucket",
            CreateBucketConfiguration={"LocationConstraint": "eu-west-1"},
        )


class TestUploadPdf:
    @pytest.mark.anyio
    async def test_happy_path(self, storage_client, mock_conn):
        """Multipart POST returns pdf_id, filepath, and bucket_name on success."""
        bucket_id = uuid4()
        project_id = uuid4()
        pdf_id = uuid4()

        bucket_record = {
            "id": bucket_id,
            "name": "my-bucket",
            "region": "us-east-1",
            "access_key_id": "key",
            "secret_access_key": "secret",
            "endpoint_url": None,
        }

        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()
        mock_s3 = MagicMock()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                data={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                files={"file": ("test.pdf", b"%PDF-1.4 test content", "application/pdf")},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["pdf_id"] == str(pdf_id)
        assert "filepath" in body
        assert body["bucket_name"] == "my-bucket"
        # filepath should be scoped under project_id
        assert str(project_id) in body["filepath"]

    @pytest.mark.anyio
    async def test_bucket_not_found_returns_404(self, storage_client, mock_conn):
        """Returns 404 when the bucket_id doesn't exist in the DB."""
        project_id = uuid4()
        bucket_id = uuid4()

        mock_conn.fetchrow = AsyncMock(return_value=None)

        response = await storage_client.post(
            "/api/v1/pdf-storage/pdfs",
            data={"project_id": str(project_id), "bucket_id": str(bucket_id)},
            files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
        )

        assert response.status_code == 404
        assert "Bucket not found" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_s3_upload_error_returns_502(self, storage_client, mock_conn):
        """A ClientError during S3 put_object propagates as 502 and rolls back DB."""
        bucket_id = uuid4()
        project_id = uuid4()
        pdf_id = uuid4()

        bucket_record = {
            "id": bucket_id,
            "name": "my-bucket",
            "region": "us-east-1",
            "access_key_id": "key",
            "secret_access_key": "secret",
            "endpoint_url": None,
        }
        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()

        client_error = _make_client_error("AccessDenied", "Access Denied")
        mock_s3 = MagicMock()
        mock_s3.put_object.side_effect = client_error

        # run_sync executes the closure directly so boto3 raises inside the try/except
        async def _run_sync_directly(fn, *args, **kwargs):
            fn()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
                side_effect=_run_sync_directly,
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                data={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
            )

        assert response.status_code == 502
        assert "S3 error" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_missing_form_fields_returns_422(self, storage_client):
        """Omitting required form fields returns 422."""
        response = await storage_client.post(
            "/api/v1/pdf-storage/pdfs",
            files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
            # no project_id or bucket_id
        )

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_uses_endpoint_url_when_bucket_has_one(self, storage_client, mock_conn):
        """boto3.client is called with endpoint_url when bucket record has one."""
        bucket_id = uuid4()
        project_id = uuid4()
        pdf_id = uuid4()

        bucket_record = {
            "id": bucket_id,
            "name": "minio-bucket",
            "region": "us-east-1",
            "access_key_id": "minio-key",
            "secret_access_key": "minio-secret",
            "endpoint_url": "http://localhost:9000",
        }
        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()
        mock_s3 = MagicMock()

        with (
            patch("boto3.client", return_value=mock_s3) as mock_boto3,
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                data={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                files={"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
            )

        assert response.status_code == 200
        mock_boto3.assert_called_once_with(
            "s3",
            aws_access_key_id="minio-key",
            aws_secret_access_key="minio-secret",
            region_name="us-east-1",
            endpoint_url="http://localhost:9000",
        )


class TestCreateBucketDuplicateName:
    @pytest.mark.anyio
    async def test_duplicate_bucket_name_returns_409(self, storage_client, mock_conn):
        """POST /buckets with a name that already exists returns 409."""
        mock_conn.fetchval = AsyncMock(
            side_effect=asyncpg.UniqueViolationError(
                "duplicate key value violates unique constraint"
            )
        )

        response = await storage_client.post(
            "/api/v1/pdf-storage/buckets",
            json={
                "name": "existing-bucket",
                "region": "us-east-1",
                "access_key_id": "key",
                "secret_access_key": "secret",
            },
        )

        assert response.status_code == 409
        assert "already registered" in response.json()["detail"]


class TestCreateBucketS3Rollback:
    @pytest.mark.anyio
    async def test_s3_failure_rolls_back_db_row(self, storage_client, mock_conn):
        """When S3 create fails, the DB row inserted by insert_bucket is deleted."""
        bucket_id = uuid4()
        mock_conn.fetchval = AsyncMock(return_value=bucket_id)
        mock_conn.execute = AsyncMock()

        client_error = _make_client_error("InternalError", "S3 internal error")
        mock_s3 = MagicMock()
        mock_s3.create_bucket.side_effect = client_error

        async def _run_sync_directly(fn, *args, **kwargs):
            fn()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
                side_effect=_run_sync_directly,
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/buckets",
                json={
                    "name": "fail-bucket",
                    "region": "us-east-1",
                    "access_key_id": "key",
                    "secret_access_key": "secret",
                },
            )

        assert response.status_code == 502
        # Verify delete_bucket was called (rollback)
        delete_calls = [
            c for c in mock_conn.execute.call_args_list if "DELETE FROM api.aws_buckets" in str(c)
        ]
        assert len(delete_calls) == 1


class TestUploadPdfS3Rollback:
    @pytest.mark.anyio
    async def test_upload_pdf_s3_failure_rolls_back_db(self, storage_client, mock_conn):
        """When S3 upload fails, the DB rows inserted by insert_pdf are deleted."""
        bucket_id = uuid4()
        project_id = uuid4()
        pdf_id = uuid4()

        bucket_record = {
            "id": bucket_id,
            "name": "my-bucket",
            "region": "us-east-1",
            "access_key_id": "key",
            "secret_access_key": "secret",
            "endpoint_url": None,
        }
        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()

        client_error = _make_client_error("AccessDenied", "Access Denied")
        mock_s3 = MagicMock()
        mock_s3.put_object.side_effect = client_error

        async def _run_sync_directly(fn, *args, **kwargs):
            fn()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
                side_effect=_run_sync_directly,
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                data={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
            )

        assert response.status_code == 502
        # Verify delete_pdf was called (rollback): api.pdfs, web.pdfs, workers.pdfs
        delete_calls = [c for c in mock_conn.execute.call_args_list if "DELETE FROM" in str(c)]
        assert len(delete_calls) == 3


class TestUploadPdfSizeLimit:
    @pytest.mark.anyio
    async def test_upload_pdf_rejects_oversized_file(self, storage_client):
        """Files exceeding MAX_PDF_SIZE are rejected with 413."""
        bucket_id = uuid4()
        project_id = uuid4()

        with patch("app.domains.pdf_storage.router.MAX_PDF_SIZE", 10):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                data={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                files={"file": ("big.pdf", b"x" * 20, "application/pdf")},
            )

        assert response.status_code == 413
        assert "50 MB" in response.json()["detail"]

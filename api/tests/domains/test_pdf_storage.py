"""Tests for the pdf_storage domain (create_bucket and upload_pdf endpoints)."""

from contextlib import asynccontextmanager
import os
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import asyncpg
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, FastAPI
import httpx
import pytest

from app.core.db import get_conn
from app.core.dependencies import verify_api_key
from app.core.exceptions import register_exception_handlers
from app.domains.pdf_storage.router import router as pdf_storage_router

_TEST_API_KEY: str = os.environ.get("API_KEY", "test-api-key")
_OWNER_USER_ID = uuid4()


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
        """POST /buckets creates a bucket with the runtime AWS credentials."""
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
                    "owner_user_id": str(_OWNER_USER_ID),
                },
            )

        assert response.status_code == 200
        body = response.json()
        assert body["bucket_id"] == str(bucket_id)
        assert body["name"] == "my-test-bucket"
        assert body["lifecycle_applied"] is True
        mock_conn.fetchval.assert_awaited_once_with(
            """
        INSERT INTO api.aws_buckets (name, region, endpoint_url, owner_user_id, owner_org_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
            "my-test-bucket",
            "us-east-1",
            None,
            str(_OWNER_USER_ID),
            None,
        )

        mock_s3.put_bucket_lifecycle_configuration.assert_called_once_with(
            Bucket="my-test-bucket",
            LifecycleConfiguration={
                "Rules": [
                    {
                        "ID": "abort-incomplete-multipart-uploads",
                        "Status": "Enabled",
                        "Filter": {"Prefix": ""},
                        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1},
                    }
                ]
            },
        )
        mock_s3.put_public_access_block.assert_called_once_with(
            Bucket="my-test-bucket",
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            },
        )
        mock_s3.put_bucket_encryption.assert_called_once_with(
            Bucket="my-test-bucket",
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
                    "owner_user_id": str(_OWNER_USER_ID),
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
                    "owner_user_id": str(_OWNER_USER_ID),
                },
            )

        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "existing-bucket"
        # Lifecycle rule is idempotent — must be (re)applied on the already-owned branch.
        assert body["lifecycle_applied"] is True
        mock_s3.head_bucket.assert_called_once_with(Bucket="existing-bucket")
        mock_s3.put_bucket_lifecycle_configuration.assert_called_once()

    @pytest.mark.anyio
    async def test_missing_name_returns_422(self, storage_client):
        """Omitting required fields returns 422 from Pydantic validation."""
        response = await storage_client.post("/api/v1/pdf-storage/buckets", json={})

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
                    "owner_user_id": str(_OWNER_USER_ID),
                },
            )

        assert response.status_code == 200
        mock_s3.create_bucket.assert_called_once_with(
            Bucket="eu-bucket",
            CreateBucketConfiguration={"LocationConstraint": "eu-west-1"},
        )

    @pytest.mark.anyio
    async def test_lifecycle_failure_does_not_fail_request(self, storage_client, mock_conn):
        """Lifecycle config failure (e.g. MinIO NotImplemented) must not fail bucket creation.

        Request returns 200 with lifecycle_applied=False and the DB row is NOT rolled back.
        """
        bucket_id = uuid4()
        mock_conn.fetchval = AsyncMock(return_value=bucket_id)
        mock_conn.execute = AsyncMock()

        mock_s3 = MagicMock()
        mock_s3.put_bucket_lifecycle_configuration.side_effect = _make_client_error(
            "NotImplemented", "lifecycle not supported"
        )

        # Run closures directly so the lifecycle ClientError raises inside the helper's try/except.
        async def _run_sync_directly(fn, *args, **kwargs):
            return fn()

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
                    "name": "minio-bucket",
                    "region": "us-east-1",
                    "endpoint_url": "http://localhost:9000",
                    "owner_user_id": str(_OWNER_USER_ID),
                },
            )

        assert response.status_code == 200
        body = response.json()
        assert body["bucket_id"] == str(bucket_id)
        assert body["name"] == "minio-bucket"
        assert body["lifecycle_applied"] is False

        # DB row must NOT be rolled back — the bucket itself is fine.
        delete_calls = [
            c for c in mock_conn.execute.call_args_list if "DELETE FROM api.aws_buckets" in str(c)
        ]
        assert delete_calls == []


def _configure_multipart_mock(mock_s3: MagicMock, upload_id: str = "upload-id-xyz") -> None:
    """Stub the three multipart calls exercised by a happy-path upload."""
    mock_s3.create_multipart_upload.return_value = {"UploadId": upload_id}
    mock_s3.upload_part.return_value = {"ETag": '"etag-0"'}
    mock_s3.complete_multipart_upload.return_value = {}


# Contract for /api/v1/pdf-storage/pdfs:
#   * project_id, bucket_id are QUERY params (not form fields)
#   * body is raw PDF bytes with Content-Type: application/pdf
#   * optional X-Filename header carries the url-encoded filename
# See api/app/domains/pdf_storage/router.py::upload_pdf.
_PDF_BODY = b"%PDF-1.4 test content"
_PDF_HEADERS = {"Content-Type": "application/pdf", "X-Filename": "test.pdf"}


class TestUploadPdf:
    @pytest.mark.anyio
    async def test_happy_path(self, storage_client, mock_conn):
        """Raw PDF POST returns pdf_id, filepath, and bucket_name on success."""
        bucket_id = uuid4()
        project_id = uuid4()
        pdf_id = uuid4()

        bucket_record = {
            "id": bucket_id,
            "name": "my-bucket",
            "region": "us-east-1",
            "endpoint_url": None,
        }

        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()
        mock_s3 = MagicMock()
        _configure_multipart_mock(mock_s3)

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                params={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                content=_PDF_BODY,
                headers=_PDF_HEADERS,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["pdf_id"] == str(pdf_id)
        assert "filepath" in body
        assert body["bucket_name"] == "my-bucket"
        # filepath should be scoped under project_id
        assert str(project_id) in body["filepath"]
        # Small body fits in the final partial part → one upload_part call, then complete.
        mock_s3.create_multipart_upload.assert_called_once()
        mock_s3.upload_part.assert_called_once()
        mock_s3.complete_multipart_upload.assert_called_once()
        mock_s3.abort_multipart_upload.assert_not_called()

    @pytest.mark.anyio
    async def test_bucket_not_found_returns_404(self, storage_client, mock_conn):
        """Returns 404 when the bucket_id doesn't exist in the DB."""
        project_id = uuid4()
        bucket_id = uuid4()

        mock_conn.fetchrow = AsyncMock(return_value=None)

        response = await storage_client.post(
            "/api/v1/pdf-storage/pdfs",
            params={"project_id": str(project_id), "bucket_id": str(bucket_id)},
            content=_PDF_BODY,
            headers=_PDF_HEADERS,
        )

        assert response.status_code == 404
        assert "Bucket not found" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_s3_upload_error_returns_502(self, storage_client, mock_conn):
        """A ClientError during S3 multipart upload propagates as 502 and rolls back DB."""
        bucket_id = uuid4()
        project_id = uuid4()
        pdf_id = uuid4()

        bucket_record = {
            "id": bucket_id,
            "name": "my-bucket",
            "region": "us-east-1",
            "endpoint_url": None,
        }
        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()

        client_error = _make_client_error("AccessDenied", "Access Denied")
        mock_s3 = MagicMock()
        mock_s3.create_multipart_upload.return_value = {"UploadId": "uid-1"}
        # Fail on the tail upload_part so the _abort_and_rollback path is exercised.
        mock_s3.upload_part.side_effect = client_error

        # run_sync executes the closure directly so boto3 raises inside the try/except
        async def _run_sync_directly(fn, *args, **kwargs):
            return fn()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
                side_effect=_run_sync_directly,
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                params={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                content=_PDF_BODY,
                headers=_PDF_HEADERS,
            )

        assert response.status_code == 502
        assert "S3 error" in response.json()["detail"]
        # Abort must fire on failure so in-progress multipart parts get cleaned up.
        mock_s3.abort_multipart_upload.assert_called_once()

    @pytest.mark.anyio
    async def test_missing_query_params_returns_422(self, storage_client):
        """Omitting required project_id/bucket_id query params returns 422."""
        response = await storage_client.post(
            "/api/v1/pdf-storage/pdfs",
            content=_PDF_BODY,
            headers=_PDF_HEADERS,
            # no project_id or bucket_id query params
        )

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_wrong_content_type_returns_415(self, storage_client, mock_conn):
        """Non-application/pdf Content-Type is rejected with 415 before any S3 work."""
        project_id = uuid4()
        bucket_id = uuid4()

        response = await storage_client.post(
            "/api/v1/pdf-storage/pdfs",
            params={"project_id": str(project_id), "bucket_id": str(bucket_id)},
            content=_PDF_BODY,
            headers={"Content-Type": "multipart/form-data"},
        )

        assert response.status_code == 415
        assert "application/pdf" in response.json()["detail"]

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
            "endpoint_url": "http://localhost:9000",
            "owner_user_id": str(_OWNER_USER_ID),
        }
        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()
        mock_s3 = MagicMock()
        _configure_multipart_mock(mock_s3)

        with (
            patch("boto3.client", return_value=mock_s3) as mock_boto3,
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                params={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                content=_PDF_BODY,
                headers={**_PDF_HEADERS, "X-Filename": "doc.pdf"},
            )

        assert response.status_code == 200
        mock_boto3.assert_called_once_with(
            "s3",
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
                "owner_user_id": str(_OWNER_USER_ID),
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
                    "owner_user_id": str(_OWNER_USER_ID),
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
        """When S3 multipart upload fails, the DB rows inserted by insert_pdf are deleted."""
        bucket_id = uuid4()
        project_id = uuid4()
        pdf_id = uuid4()

        bucket_record = {
            "id": bucket_id,
            "name": "my-bucket",
            "region": "us-east-1",
            "endpoint_url": None,
        }
        mock_conn.fetchrow = AsyncMock(return_value=bucket_record)
        mock_conn.fetchval = AsyncMock(return_value=pdf_id)
        mock_conn.execute = AsyncMock()

        client_error = _make_client_error("AccessDenied", "Access Denied")
        mock_s3 = MagicMock()
        mock_s3.create_multipart_upload.return_value = {"UploadId": "uid-rollback"}
        mock_s3.upload_part.side_effect = client_error

        async def _run_sync_directly(fn, *args, **kwargs):
            return fn()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
                side_effect=_run_sync_directly,
            ),
        ):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                params={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                content=_PDF_BODY,
                headers=_PDF_HEADERS,
            )

        assert response.status_code == 502
        # Verify delete_pdf was called (rollback): web.pdfs, workers.pdfs
        delete_calls = [c for c in mock_conn.execute.call_args_list if "DELETE FROM" in str(c)]
        assert len(delete_calls) == 2
        mock_s3.abort_multipart_upload.assert_called_once()


class TestGetPdfUrl:
    """GET /pdf-storage/pdfs/{pdf_id}/url — presigned S3 GET URL for the browser."""

    @pytest.mark.anyio
    async def test_happy_path(self, storage_client, mock_conn):
        """Returns a signed URL, the TTL, and the pdf_id on success."""
        pdf_id = uuid4()
        bucket_id = uuid4()
        owner_id = uuid4()
        pdf_row = {
            "id": pdf_id,
            "bucket_id": bucket_id,
            "filepath": f"{uuid4()}/{uuid4()}/doc.pdf",
            "name": "doc.pdf",
            "project_id": uuid4(),
            "owner_id": owner_id,
        }
        bucket_row = {
            "id": bucket_id,
            "name": "my-bucket",
            "region": "us-east-1",
            "endpoint_url": None,
        }
        # First fetchrow is fetch_pdf_by_id, second is fetch_bucket_by_id.
        mock_conn.fetchrow = AsyncMock(side_effect=[pdf_row, bucket_row])

        signed_url = "https://my-bucket.s3.amazonaws.com/signed?X-Amz-Signature=abc"
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = signed_url

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "anyio.to_thread.run_sync",
                new=AsyncMock(side_effect=lambda fn, *args, **kwargs: fn()),
            ),
        ):
            response = await storage_client.get(
                f"/api/v1/pdf-storage/pdfs/{pdf_id}/url",
                headers={"X-User-Id": str(owner_id)},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["url"] == signed_url
        assert body["expires_in"] == 3600
        assert body["pdf_id"] == str(pdf_id)

        mock_s3.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": "my-bucket", "Key": pdf_row["filepath"]},
            ExpiresIn=3600,
        )

    @pytest.mark.anyio
    async def test_missing_forwarded_user_header_returns_401(self, storage_client):
        response = await storage_client.get(f"/api/v1/pdf-storage/pdfs/{uuid4()}/url")
        assert response.status_code == 401
        assert "Missing X-User-Id header" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_cross_project_pdf_id_returns_403(self, storage_client, mock_conn):
        pdf_id = uuid4()
        bucket_id = uuid4()
        mock_conn.fetchrow = AsyncMock(
            return_value={
                "id": pdf_id,
                "bucket_id": bucket_id,
                "filepath": "other-project.pdf",
                "name": "other-project.pdf",
                "project_id": uuid4(),
                "owner_id": uuid4(),
            }
        )

        response = await storage_client.get(
            f"/api/v1/pdf-storage/pdfs/{pdf_id}/url",
            headers={"X-User-Id": str(uuid4())},
        )

        assert response.status_code == 403
        assert "do not have access" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_pdf_not_found_returns_404(self, storage_client, mock_conn):
        """Unknown pdf_id → 404."""
        mock_conn.fetchrow = AsyncMock(return_value=None)
        response = await storage_client.get(
            f"/api/v1/pdf-storage/pdfs/{uuid4()}/url",
            headers={"X-User-Id": str(uuid4())},
        )
        assert response.status_code == 404
        assert "PDF not found" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_orphaned_bucket_returns_500(self, storage_client, mock_conn):
        """pdf row exists but its bucket doesn't — surface as 500."""
        pdf_id = uuid4()
        bucket_id = uuid4()
        owner_id = uuid4()
        pdf_row = {
            "id": pdf_id,
            "bucket_id": bucket_id,
            "filepath": "path/to/file.pdf",
            "name": "file.pdf",
            "project_id": uuid4(),
            "owner_id": owner_id,
        }
        mock_conn.fetchrow = AsyncMock(side_effect=[pdf_row, None])

        response = await storage_client.get(
            f"/api/v1/pdf-storage/pdfs/{pdf_id}/url",
            headers={"X-User-Id": str(owner_id)},
        )
        assert response.status_code == 500
        assert "bucket missing" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_s3_client_error_returns_502(self, storage_client, mock_conn):
        """S3 ClientError during sign → 502."""
        pdf_id = uuid4()
        bucket_id = uuid4()
        owner_id = uuid4()
        mock_conn.fetchrow = AsyncMock(
            side_effect=[
                {
                    "id": pdf_id,
                    "bucket_id": bucket_id,
                    "filepath": "f.pdf",
                    "name": "f.pdf",
                    "project_id": uuid4(),
                    "owner_id": owner_id,
                },
                {
                    "id": bucket_id,
                    "name": "b",
                    "region": "us-east-1",
                    "endpoint_url": None,
                },
            ]
        )
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = _make_client_error(
            "SignatureDoesNotMatch", "bad sig"
        )

        async def _run_sync_directly(fn, *args, **kwargs):
            return fn()

        with (
            patch("boto3.client", return_value=mock_s3),
            patch(
                "app.domains.pdf_storage.service.anyio.to_thread.run_sync",
                side_effect=_run_sync_directly,
            ),
        ):
            response = await storage_client.get(
                f"/api/v1/pdf-storage/pdfs/{pdf_id}/url",
                headers={"X-User-Id": str(owner_id)},
            )

        assert response.status_code == 502
        assert "S3 error" in response.json()["detail"]


class TestUploadPdfSizeLimit:
    @pytest.mark.anyio
    async def test_upload_pdf_rejects_oversized_file(self, storage_client):
        """Content-Length exceeding MAX_PDF_SIZE is rejected with 413 at the router."""
        bucket_id = uuid4()
        project_id = uuid4()

        with patch("app.domains.pdf_storage.router.MAX_PDF_SIZE", 10):
            response = await storage_client.post(
                "/api/v1/pdf-storage/pdfs",
                params={"project_id": str(project_id), "bucket_id": str(bucket_id)},
                content=b"x" * 20,
                headers={"Content-Type": "application/pdf"},
            )

        assert response.status_code == 413
        assert "50 MB" in response.json()["detail"]

from dataclasses import asdict
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

from pdf_ocr_utils.exceptions import OcrExecutionError
from pdfium_utils.search_and_annotate import PhraseHighlightResult
import pytest

from app.domains.pdf_utils import service
from app.domains.pdf_utils.schemas import ExtractTextRequest, HighlightRequest


@pytest.fixture
def sample_row():
    return {
        "filepath": "pdfs/original/test.pdf",
        "bucket_name": "my-bucket",
        "name": "test.pdf",
        "project_id": uuid4(),
        "region": "us-east-1",
        "access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "endpoint_url": None,
    }


@pytest.fixture
def sample_request():
    return HighlightRequest(
        pdf_id=UUID("12345678-1234-5678-1234-567812345678"),
        phrases={"hello": "#FF0000"},
        output_key="pdfs/highlighted/test_highlighted.pdf",
    )


@pytest.fixture
def sample_extract_row():
    return {
        "filepath": "pdfs/original/test.pdf",
        "bucket_name": "my-bucket",
        "name": "test.pdf",
        "project_id": uuid4(),
        "full_text": None,
        "extract_method": None,
        "text_by_page": None,
        "region": "us-east-1",
        "access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "secret_access_key": "WJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "endpoint_url": None,
    }


@pytest.fixture
def extract_request():
    return ExtractTextRequest(
        pdf_id=UUID("12345678-1234-5678-1234-567812345678"),
        ocr_model="deepseek-ocr",
    )


class TestHighlight:
    @pytest.mark.anyio
    async def test_returns_expected_dict_on_happy_path(self, sample_row, sample_request):
        """Happy path returns a dict with all expected keys and correct values."""
        phrase_result = PhraseHighlightResult("hello", found=True, occurrences=2, pages=[1])
        mock_conn = AsyncMock()
        mock_s3 = MagicMock()

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_row),
            ),
            patch("boto3.client", return_value=mock_s3),
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf-bytes")),
            patch(
                "anyio.to_process.run_sync",
                AsyncMock(return_value=[(b"output-bytes", [phrase_result])]),
            ),
            patch("app.integrations.s3.put_object_bytes", AsyncMock()),
        ):
            result = await service.highlight(mock_conn, sample_request)

        assert result["pdf_id"] == str(sample_request.pdf_id)
        assert result["output_key"] == sample_request.output_key
        assert result["bucket"] == sample_row["bucket_name"]
        assert result["total_phrases"] == 1
        assert result["successfully_highlighted"] == 1
        assert result["results"] == [asdict(phrase_result)]

    @pytest.mark.anyio
    async def test_raises_lookup_error_when_pdf_not_found(self, sample_request):
        """Raises LookupError when repository returns None for the given pdf_id."""
        mock_conn = AsyncMock()

        with patch("app.domains.pdf_utils.repository.fetch_pdf", AsyncMock(return_value=None)):
            with pytest.raises(LookupError, match="PDF not found"):
                await service.highlight(mock_conn, sample_request)

    @pytest.mark.anyio
    async def test_raises_lookup_error_when_bucket_is_null(self, sample_request):
        """Raises LookupError when the row has no bucket configured."""
        row_no_bucket = {
            "filepath": "pdfs/test.pdf",
            "bucket_name": None,
            "name": "test.pdf",
            "project_id": uuid4(),
            "region": "us-east-1",
            "access_key_id": "key",
            "secret_access_key": "secret",
            "endpoint_url": None,
        }
        mock_conn = AsyncMock()

        with patch(
            "app.domains.pdf_utils.repository.fetch_pdf",
            AsyncMock(return_value=row_no_bucket),
        ):
            with pytest.raises(LookupError, match="no S3 bucket configured"):
                await service.highlight(mock_conn, sample_request)

    @pytest.mark.anyio
    async def test_downloads_from_bucket_and_key_in_row(self, sample_row, sample_request):
        """S3 download is called with the bucket and filepath from the DB row."""
        mock_conn = AsyncMock()
        mock_s3 = MagicMock()
        mock_get = AsyncMock(return_value=b"pdf")

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_row),
            ),
            patch("boto3.client", return_value=mock_s3),
            patch("app.integrations.s3.get_object_bytes", mock_get),
            patch("anyio.to_process.run_sync", AsyncMock(return_value=[(b"out", [])])),
            patch("app.integrations.s3.put_object_bytes", AsyncMock()),
        ):
            await service.highlight(mock_conn, sample_request)

        mock_get.assert_called_once_with(mock_s3, sample_row["bucket_name"], sample_row["filepath"])

    @pytest.mark.anyio
    async def test_uploads_output_bytes_to_output_key(self, sample_row, sample_request):
        """S3 upload is called with the output bytes and the request's output_key."""
        mock_conn = AsyncMock()
        mock_s3 = MagicMock()
        mock_put = AsyncMock()
        output_bytes = b"highlighted-pdf-content"

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_row),
            ),
            patch("boto3.client", return_value=mock_s3),
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch(
                "anyio.to_process.run_sync",
                AsyncMock(return_value=[(output_bytes, [])]),
            ),
            patch("app.integrations.s3.put_object_bytes", mock_put),
        ):
            await service.highlight(mock_conn, sample_request)

        mock_put.assert_called_once_with(
            mock_s3, sample_row["bucket_name"], sample_request.output_key, output_bytes
        )

    @pytest.mark.anyio
    async def test_counts_only_found_phrases_in_successfully_highlighted(self, sample_row):
        """successfully_highlighted counts only results where found=True."""
        results = [
            PhraseHighlightResult("hello", found=True, occurrences=1, pages=[1]),
            PhraseHighlightResult("missing", found=False),
        ]
        mock_conn = AsyncMock()
        mock_s3 = MagicMock()
        request = HighlightRequest(
            pdf_id=UUID("12345678-1234-5678-1234-567812345678"),
            phrases={"hello": "#FF0000", "missing": "#00FF00"},
            output_key="output/out.pdf",
        )

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_row),
            ),
            patch("boto3.client", return_value=mock_s3),
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch("anyio.to_process.run_sync", AsyncMock(return_value=[(b"out", results)])),
            patch("app.integrations.s3.put_object_bytes", AsyncMock()),
        ):
            result = await service.highlight(mock_conn, request)

        assert result["total_phrases"] == 2
        assert result["successfully_highlighted"] == 1

    @pytest.mark.anyio
    async def test_builds_s3_client_with_endpoint_url_when_present(self, sample_request):
        """boto3.client is called with endpoint_url when row has one."""
        mock_conn = AsyncMock()
        mock_s3 = MagicMock()
        row_with_endpoint = {
            "filepath": "pdfs/test.pdf",
            "bucket_name": "my-bucket",
            "name": "test.pdf",
            "project_id": uuid4(),
            "region": "us-east-1",
            "access_key_id": "key",
            "secret_access_key": "secret",
            "endpoint_url": "https://s3.custom.example.com",
        }

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=row_with_endpoint),
            ),
            patch("boto3.client", return_value=mock_s3) as mock_boto3,
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch("anyio.to_process.run_sync", AsyncMock(return_value=[(b"out", [])])),
            patch("app.integrations.s3.put_object_bytes", AsyncMock()),
        ):
            await service.highlight(mock_conn, sample_request)

        mock_boto3.assert_called_once_with(
            "s3",
            aws_access_key_id="key",
            aws_secret_access_key="secret",
            region_name="us-east-1",
            endpoint_url="https://s3.custom.example.com",
        )


class TestExtractText:
    @pytest.mark.anyio
    async def test_metadata_hit_returns_without_download_or_extraction(
        self, sample_extract_row, extract_request
    ):
        row = {
            **sample_extract_row,
            "full_text": "Existing text",
            "extract_method": "pdfium",
            "text_by_page": {"pages": [{"page_index": 0, "text": "Existing text"}]},
        }
        mock_conn = AsyncMock()

        with (
            patch("app.domains.pdf_utils.repository.fetch_pdf", AsyncMock(return_value=row)),
            patch("app.integrations.s3.get_object_bytes", AsyncMock()) as mock_get,
            patch("app.domains.pdf_utils.service.extract_pdfium_text_by_page") as mock_pdfium,
            patch("app.domains.pdf_utils.service._run_ocr_extract") as mock_ocr,
        ):
            result = await service.extract_text(mock_conn, extract_request)

        assert result.source == "metadata"
        assert result.full_text == "Existing text"
        assert result.extract_method == "pdfium"
        assert result.ocr_model is None
        mock_get.assert_not_called()
        mock_pdfium.assert_not_called()
        mock_ocr.assert_not_called()

    @pytest.mark.anyio
    async def test_blank_metadata_uses_pdfium_persists_and_skips_ocr(
        self, sample_extract_row, extract_request
    ):
        mock_conn = AsyncMock()
        mock_update = AsyncMock()

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value={**sample_extract_row, "full_text": "   "}),
            ),
            patch("boto3.client", return_value=MagicMock()),
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch(
                "app.domains.pdf_utils.service.extract_pdfium_text_by_page",
                return_value=[{"page_index": 0, "text": " Native text "}],
            ),
            patch("app.domains.pdf_utils.repository.update_pdf_text_metadata", mock_update),
            patch("app.domains.pdf_utils.service._run_ocr_extract") as mock_ocr,
        ):
            result = await service.extract_text(mock_conn, extract_request)

        assert result.source == "pdfium"
        assert result.full_text == "Native text"
        assert result.text_by_page == {"pages": [{"page_index": 0, "text": " Native text "}]}
        mock_update.assert_awaited_once_with(
            mock_conn,
            extract_request.pdf_id,
            full_text="Native text",
            extract_method="pdfium",
            text_by_page={"pages": [{"page_index": 0, "text": " Native text "}]},
        )
        mock_ocr.assert_not_called()

    @pytest.mark.anyio
    async def test_blank_pdfium_uses_selected_ocr_model_and_persists(
        self, sample_extract_row, extract_request
    ):
        mock_conn = AsyncMock()
        mock_update = AsyncMock()

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_extract_row),
            ),
            patch("boto3.client", return_value=MagicMock()),
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch(
                "app.domains.pdf_utils.service.extract_pdfium_text_by_page",
                return_value=[{"page_index": 0, "text": "   "}],
            ),
            patch(
                "app.domains.pdf_utils.service._run_ocr_extract",
                return_value={"pages": [{"page_index": 0, "text": " OCR text "}]},
            ) as mock_ocr,
            patch("app.domains.pdf_utils.repository.update_pdf_text_metadata", mock_update),
        ):
            result = await service.extract_text(mock_conn, extract_request)

        assert result.source == "ocr"
        assert result.ocr_model == "deepseek-ocr"
        assert result.extract_method == "deepseek"
        assert result.full_text == "OCR text"
        mock_ocr.assert_called_once()
        mock_update.assert_awaited_once_with(
            mock_conn,
            extract_request.pdf_id,
            full_text="OCR text",
            extract_method="deepseek",
            text_by_page={"pages": [{"page_index": 0, "text": " OCR text "}]},
        )

    @pytest.mark.anyio
    async def test_missing_selected_runpod_endpoint_raises_validation_error(
        self, sample_extract_row
    ):
        request = ExtractTextRequest(
            pdf_id=UUID("12345678-1234-5678-1234-567812345678"),
            ocr_model="olm-ocr2",
        )
        mock_conn = AsyncMock()

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_extract_row),
            ),
            patch("boto3.client", return_value=MagicMock()),
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch(
                "app.domains.pdf_utils.service.extract_pdfium_text_by_page",
                return_value=[{"page_index": 0, "text": ""}],
            ),
            patch(
                "app.domains.pdf_utils.service.make_runpod_ocr_client",
                side_effect=ValueError("Missing Runpod OCR endpoint URL for model 'olm-ocr2'"),
            ),
        ):
            with pytest.raises(ValueError, match="Missing Runpod OCR endpoint URL"):
                await service.extract_text(mock_conn, request)

    @pytest.mark.anyio
    async def test_ocr_blank_text_does_not_persist(self, sample_extract_row, extract_request):
        mock_conn = AsyncMock()
        mock_update = AsyncMock()

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_extract_row),
            ),
            patch("boto3.client", return_value=MagicMock()),
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch(
                "app.domains.pdf_utils.service.extract_pdfium_text_by_page",
                return_value=[{"page_index": 0, "text": ""}],
            ),
            patch(
                "app.domains.pdf_utils.service._run_ocr_extract",
                return_value={"pages": [{"page_index": 0, "text": "   "}]},
            ),
            patch("app.domains.pdf_utils.repository.update_pdf_text_metadata", mock_update),
        ):
            with pytest.raises(ValueError, match="No text extracted"):
                await service.extract_text(mock_conn, extract_request)

        mock_update.assert_not_called()

    @pytest.mark.anyio
    async def test_ocr_execution_failure_maps_to_502(self, async_client, extract_request):
        with patch(
            "app.domains.pdf_utils.service.extract_text",
            AsyncMock(side_effect=OcrExecutionError("endpoint failed")),
        ):
            response = await async_client.post(
                "/api/v1/pdf-utils/extract-text",
                json={
                    "pdf_id": str(extract_request.pdf_id),
                    "ocr_model": extract_request.ocr_model,
                },
            )

        assert response.status_code == 502
        assert response.json()["detail"] == "OCR error: endpoint failed"

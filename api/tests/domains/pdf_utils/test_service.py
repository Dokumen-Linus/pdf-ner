from dataclasses import asdict
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

from api.app.domains.pdf_utils.pdfium_utils import PhraseHighlightResult
import pytest

from app.domains.pdf_utils import service
from app.domains.pdf_utils.schemas import HighlightRequest


@pytest.fixture
def sample_row():
    return {
        "location": "pdfs/original/test.pdf",
        "bucket": "my-bucket",
        "name": "test.pdf",
        "project_id": uuid4(),
    }


@pytest.fixture
def sample_request():
    return HighlightRequest(
        pdf_id=UUID("12345678-1234-5678-1234-567812345678"),
        phrases={"hello": "#FF0000"},
        output_key="pdfs/highlighted/test_highlighted.pdf",
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
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf-bytes")),
            patch(
                "anyio.to_process.run_sync",
                AsyncMock(return_value=[(b"output-bytes", [phrase_result])]),
            ),
            patch("app.integrations.s3.put_object_bytes", AsyncMock()),
        ):
            result = await service.highlight(mock_conn, mock_s3, sample_request)

        assert result["pdf_id"] == str(sample_request.pdf_id)
        assert result["output_key"] == sample_request.output_key
        assert result["bucket"] == sample_row["bucket"]
        assert result["total_phrases"] == 1
        assert result["successfully_highlighted"] == 1
        assert result["results"] == [asdict(phrase_result)]

    @pytest.mark.anyio
    async def test_raises_lookup_error_when_pdf_not_found(self, sample_request):
        """Raises LookupError when repository returns None for the given pdf_id."""
        mock_conn = AsyncMock()

        with patch("app.domains.pdf_utils.repository.fetch_pdf", AsyncMock(return_value=None)):
            with pytest.raises(LookupError, match="PDF not found"):
                await service.highlight(mock_conn, MagicMock(), sample_request)

    @pytest.mark.anyio
    async def test_raises_lookup_error_when_bucket_is_null(self, sample_request):
        """Raises LookupError when the row has no bucket configured."""
        row_no_bucket = {
            "location": "pdfs/test.pdf",
            "bucket": None,
            "name": "test.pdf",
            "project_id": uuid4(),
        }
        mock_conn = AsyncMock()

        with patch(
            "app.domains.pdf_utils.repository.fetch_pdf",
            AsyncMock(return_value=row_no_bucket),
        ):
            with pytest.raises(LookupError, match="no S3 bucket configured"):
                await service.highlight(mock_conn, MagicMock(), sample_request)

    @pytest.mark.anyio
    async def test_downloads_from_bucket_and_key_in_row(self, sample_row, sample_request):
        """S3 download is called with the bucket and location from the DB row."""
        mock_conn = AsyncMock()
        mock_s3 = MagicMock()
        mock_get = AsyncMock(return_value=b"pdf")

        with (
            patch(
                "app.domains.pdf_utils.repository.fetch_pdf",
                AsyncMock(return_value=sample_row),
            ),
            patch("app.integrations.s3.get_object_bytes", mock_get),
            patch("anyio.to_process.run_sync", AsyncMock(return_value=[(b"out", [])])),
            patch("app.integrations.s3.put_object_bytes", AsyncMock()),
        ):
            await service.highlight(mock_conn, mock_s3, sample_request)

        mock_get.assert_called_once_with(mock_s3, sample_row["bucket"], sample_row["location"])

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
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch(
                "anyio.to_process.run_sync",
                AsyncMock(return_value=[(output_bytes, [])]),
            ),
            patch("app.integrations.s3.put_object_bytes", mock_put),
        ):
            await service.highlight(mock_conn, mock_s3, sample_request)

        mock_put.assert_called_once_with(
            mock_s3, sample_row["bucket"], sample_request.output_key, output_bytes
        )

    @pytest.mark.anyio
    async def test_counts_only_found_phrases_in_successfully_highlighted(self, sample_row):
        """successfully_highlighted counts only results where found=True."""
        results = [
            PhraseHighlightResult("hello", found=True, occurrences=1, pages=[1]),
            PhraseHighlightResult("missing", found=False),
        ]
        mock_conn = AsyncMock()
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
            patch("app.integrations.s3.get_object_bytes", AsyncMock(return_value=b"pdf")),
            patch("anyio.to_process.run_sync", AsyncMock(return_value=[(b"out", results)])),
            patch("app.integrations.s3.put_object_bytes", AsyncMock()),
        ):
            result = await service.highlight(mock_conn, MagicMock(), request)

        assert result["total_phrases"] == 2
        assert result["successfully_highlighted"] == 1

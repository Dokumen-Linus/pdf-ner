from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import httpx
import numpy as np
from pdf_ocr_utils import (
    OcrConfig,
    PageTextResult,
    PdfiumRenderer,
    RunpodOcrClient,
    RunpodOcrEndpointConfig,
    TesseractOcrEngine,
    extract_text_from_array,
    extract_text_from_pdf,
    extract_text_from_pdf_by_page,
    extract_text_from_pdf_by_page_via_image_bytes,
    extract_text_from_pdf_via_image_bytes,
    make_runpod_ocr_client,
    render_pdf_page_to_array,
    render_pdf_page_to_png_bytes,
)
from pdf_ocr_utils.exceptions import OcrExecutionError, PdfRenderError
from PIL import Image
import pytesseract
import pytest


class TestPdfiumRenderer:
    def test_normalize_array_casts_uint8_and_strips_alpha(self):
        source = np.zeros((4, 5, 4), dtype=np.float32)

        normalized = PdfiumRenderer._normalize_array(source)

        assert normalized.dtype == np.uint8
        assert normalized.shape == (4, 5, 3)
        assert normalized.flags["C_CONTIGUOUS"]

    def test_render_page_to_array_raises_pdf_render_error_on_open_failure(self):
        with patch(
            "pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument", side_effect=ValueError("boom")
        ):
            with pytest.raises(PdfRenderError, match="Failed to render page 0"):
                render_pdf_page_to_array(Path("missing.pdf"), 0)

    def test_render_page_to_array_uses_pdf_page_render_api(self):
        rendered = np.zeros((2, 3, 4), dtype=np.uint8)
        mock_bitmap = type("MockBitmap", (), {"to_numpy": lambda self: rendered})()
        mock_page = type("MockPage", (), {"render": lambda self, **kwargs: mock_bitmap})()

        with patch("pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument") as mock_document:
            mock_document.return_value.__enter__.return_value.__getitem__.return_value = mock_page

            result = render_pdf_page_to_array(Path("sample.pdf"), 0)

        assert result.shape == (2, 3, 3)

    def test_render_page_to_png_bytes_uses_pdf_page_render_api(self):
        rendered = np.zeros((2, 3, 4), dtype=np.uint8)
        mock_bitmap = type("MockBitmap", (), {"to_numpy": lambda self: rendered})()
        mock_page = type("MockPage", (), {"render": lambda self, **kwargs: mock_bitmap})()

        with patch("pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument") as mock_document:
            mock_document.return_value.__enter__.return_value.__getitem__.return_value = mock_page

            result = render_pdf_page_to_png_bytes(Path("sample.pdf"), 0)

        assert result.startswith(b"\x89PNG\r\n\x1a\n")
        with Image.open(BytesIO(result)) as image:
            assert image.format == "PNG"
            assert image.size == (3, 2)

    def test_iter_pages_to_arrays_uses_pdf_page_render_api(self):
        first = np.zeros((1, 1, 4), dtype=np.uint8)
        second = np.zeros((1, 2, 3), dtype=np.uint8)
        mock_pages = [
            type(
                "MockPage",
                (),
                {
                    "render": lambda self, array=array, **kwargs: type(
                        "MockBitmap", (), {"to_numpy": lambda self: array}
                    )()
                },
            )()
            for array in (first, second)
        ]

        with patch("pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument") as mock_document:
            mock_document.return_value.__enter__.return_value.__iter__.return_value = iter(
                mock_pages
            )

            result = list(PdfiumRenderer().iter_pages_to_arrays(Path("sample.pdf")))

        assert [page_index for page_index, _ in result] == [0, 1]
        assert result[0][1].shape == (1, 1, 3)
        assert result[1][1].shape == (1, 2, 3)

    def test_iter_pages_to_png_bytes_preserves_page_indexes(self):
        first = np.zeros((1, 1, 4), dtype=np.uint8)
        second = np.zeros((1, 2, 3), dtype=np.uint8)
        mock_pages = [
            type(
                "MockPage",
                (),
                {
                    "render": lambda self, array=array, **kwargs: type(
                        "MockBitmap", (), {"to_numpy": lambda self: array}
                    )()
                },
            )()
            for array in (first, second)
        ]

        with patch("pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument") as mock_document:
            mock_document.return_value.__enter__.return_value.__iter__.return_value = iter(
                mock_pages
            )

            result = list(PdfiumRenderer().iter_pages_to_png_bytes(Path("sample.pdf")))

        assert [page_index for page_index, _ in result] == [0, 1]
        assert all(image_bytes.startswith(b"\x89PNG\r\n\x1a\n") for _, image_bytes in result)


class TestTesseractOcrEngine:
    def test_prepare_image_strips_alpha_and_makes_contiguous(self):
        image = np.zeros((3, 4, 4), dtype=np.uint8)[:, :, :]

        prepared = TesseractOcrEngine._prepare_image(image)

        assert prepared.shape == (3, 4, 3)
        assert prepared.flags["C_CONTIGUOUS"]

    def test_prepare_image_rejects_invalid_shape(self):
        image = np.zeros((2, 2, 2), dtype=np.uint8)

        with pytest.raises(ValueError, match="image must have shape"):
            TesseractOcrEngine._prepare_image(image)

    def test_extract_text_from_array_passes_through_config(self):
        image = np.zeros((2, 2), dtype=np.uint8)

        with patch(
            "pdf_ocr_utils.ocr.tesseract.pytesseract.image_to_string", return_value="hello"
        ) as mock_ocr:
            result = extract_text_from_array(
                image,
                OcrConfig(lang="eng", config="--psm 4", timeout=5.0),
            )

        assert result == "hello"
        mock_ocr.assert_called_once()
        _, kwargs = mock_ocr.call_args
        assert kwargs == {"lang": "eng", "config": "--psm 4", "timeout": 5.0}

    def test_extract_text_from_image_bytes_decodes_png(self):
        png_buffer = BytesIO()
        Image.new("RGB", (2, 3), "white").save(png_buffer, format="PNG")

        with patch(
            "pdf_ocr_utils.ocr.tesseract.pytesseract.image_to_string", return_value="hello"
        ) as mock_ocr:
            result = TesseractOcrEngine().extract_text_from_image_bytes(png_buffer.getvalue())

        assert result == "hello"
        image_arg = mock_ocr.call_args.args[0]
        assert image_arg.shape == (3, 2, 3)

    def test_extract_text_from_array_wraps_runtime_error(self):
        image = np.zeros((2, 2), dtype=np.uint8)

        with patch(
            "pdf_ocr_utils.ocr.tesseract.pytesseract.image_to_string",
            side_effect=RuntimeError("tesseract timed out"),
        ):
            with pytest.raises(OcrExecutionError, match="tesseract timed out"):
                extract_text_from_array(image)

    def test_extract_text_from_array_wraps_missing_tesseract_binary_error(self):
        image = np.zeros((2, 2), dtype=np.uint8)
        error = pytesseract.TesseractNotFoundError()

        with patch(
            "pdf_ocr_utils.ocr.tesseract.pytesseract.image_to_string",
            side_effect=error,
        ):
            with pytest.raises(OcrExecutionError, match=str(error)):
                extract_text_from_array(image)


class StubRenderer:
    def __init__(self, pages):
        self.pages = pages

    def iter_pages_to_arrays(self, pdf_path):
        del pdf_path
        yield from self.pages


class StubOcrEngine:
    def __init__(self, outputs):
        self.outputs = list(outputs)

    def extract_text_from_array(self, image):
        del image
        return self.outputs.pop(0)


class StubImageBytesRenderer:
    def __init__(self, pages):
        self.pages = pages

    def iter_pages_to_png_bytes(self, pdf_path):
        del pdf_path
        yield from self.pages


class StubImageBytesOcrEngine:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.images = []

    def extract_text_from_image_bytes(self, image):
        self.images.append(image)
        return self.outputs.pop(0)


class TestPipelines:
    def test_extract_text_from_pdf_joins_trimmed_page_text(self):
        renderer = StubRenderer(
            [
                (0, np.zeros((1, 1), dtype=np.uint8)),
                (1, np.zeros((1, 1), dtype=np.uint8)),
            ]
        )
        ocr_engine = StubOcrEngine([" page one\n", "page two  "])

        result = extract_text_from_pdf("sample.pdf", renderer=renderer, ocr_engine=ocr_engine)

        assert result == "page one\n\npage two"

    def test_extract_text_from_pdf_by_page_returns_structured_results(self):
        renderer = StubRenderer(
            [
                (0, np.zeros((1, 1), dtype=np.uint8)),
                (1, np.zeros((1, 1), dtype=np.uint8)),
            ]
        )
        ocr_engine = StubOcrEngine(["first", "second"])

        result = extract_text_from_pdf_by_page(
            "sample.pdf", renderer=renderer, ocr_engine=ocr_engine
        )

        assert result == [
            PageTextResult(page_index=0, text="first"),
            PageTextResult(page_index=1, text="second"),
        ]

    def test_extract_text_from_pdf_via_image_bytes_joins_trimmed_page_text(self):
        renderer = StubImageBytesRenderer([(0, b"first-image"), (1, b"second-image")])
        ocr_engine = StubImageBytesOcrEngine([" first\n", "second  "])

        result = extract_text_from_pdf_via_image_bytes(
            "sample.pdf", renderer=renderer, ocr_engine=ocr_engine
        )

        assert result == "first\n\nsecond"
        assert ocr_engine.images == [b"first-image", b"second-image"]

    def test_extract_text_from_pdf_by_page_via_image_bytes_returns_structured_results(self):
        renderer = StubImageBytesRenderer([(0, b"first-image"), (1, b"second-image")])
        ocr_engine = StubImageBytesOcrEngine(["first", "second"])

        result = extract_text_from_pdf_by_page_via_image_bytes(
            "sample.pdf", renderer=renderer, ocr_engine=ocr_engine
        )

        assert result == [
            PageTextResult(page_index=0, text="first"),
            PageTextResult(page_index=1, text="second"),
        ]


class TestRunpodOcrClient:
    def test_extract_text_from_image_bytes_posts_png_and_returns_text(self):
        def handler(request):
            assert request.method == "POST"
            assert str(request.url) == "https://example.test/ocr"
            assert request.headers["accept"] == "application/json"
            assert request.headers["authorization"] == "Bearer test-key"
            assert request.headers["content-type"] == "image/png"
            assert request.content == b"png-bytes"
            return httpx.Response(200, json={"text": "hello"})

        http_client = httpx.Client(transport=httpx.MockTransport(handler))
        client = RunpodOcrClient(
            "https://example.test/ocr",
            api_key="test-key",
            client=http_client,
        )

        result = client.extract_text_from_image_bytes(b"png-bytes")

        assert result == "hello"

    def test_extract_text_from_image_bytes_rejects_missing_text(self):
        http_client = httpx.Client(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, json={}))
        )
        client = RunpodOcrClient("https://example.test/ocr", client=http_client)

        with pytest.raises(OcrExecutionError, match="missing string field 'text'"):
            client.extract_text_from_image_bytes(b"png-bytes")

    def test_extract_text_from_image_bytes_wraps_http_status_error(self):
        http_client = httpx.Client(
            transport=httpx.MockTransport(lambda request: httpx.Response(503, text="warming up"))
        )
        client = RunpodOcrClient("https://example.test/ocr", client=http_client)

        with pytest.raises(OcrExecutionError, match="503: warming up"):
            client.extract_text_from_image_bytes(b"png-bytes")

    def test_extract_text_from_image_bytes_wraps_invalid_json(self):
        http_client = httpx.Client(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, text="nope"))
        )
        client = RunpodOcrClient("https://example.test/ocr", client=http_client)

        with pytest.raises(OcrExecutionError, match="not valid JSON"):
            client.extract_text_from_image_bytes(b"png-bytes")

    def test_extract_text_from_image_bytes_wraps_request_error(self):
        def handler(request):
            raise httpx.ConnectError("boom", request=request)

        http_client = httpx.Client(transport=httpx.MockTransport(handler))
        client = RunpodOcrClient("https://example.test/ocr", client=http_client)

        with pytest.raises(OcrExecutionError, match="request failed"):
            client.extract_text_from_image_bytes(b"png-bytes")

    def test_make_runpod_ocr_client_selects_deepseek_endpoint(self):
        client = make_runpod_ocr_client(
            "deepseek-ocr",
            {
                "deepseek-ocr": RunpodOcrEndpointConfig(
                    model="deepseek-ocr",
                    endpoint_url="https://deepseek.test/ocr",
                    api_key="test-key",
                    timeout=12.0,
                    retries=2,
                ),
                "olm-ocr2": RunpodOcrEndpointConfig(
                    model="olm-ocr2",
                    endpoint_url="https://olm.test/ocr",
                ),
            },
            client=httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200))),
        )

        assert client.endpoint_url == "https://deepseek.test/ocr"
        assert client.api_key == "test-key"
        assert client.timeout == 12.0
        assert client.retries == 2

    def test_make_runpod_ocr_client_selects_olm_endpoint(self):
        client = make_runpod_ocr_client(
            "olm-ocr2",
            {
                "deepseek-ocr": RunpodOcrEndpointConfig(
                    model="deepseek-ocr",
                    endpoint_url="https://deepseek.test/ocr",
                ),
                "olm-ocr2": RunpodOcrEndpointConfig(
                    model="olm-ocr2",
                    endpoint_url="https://olm.test/ocr",
                ),
            },
            client=httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200))),
        )

        assert client.endpoint_url == "https://olm.test/ocr"

    def test_make_runpod_ocr_client_rejects_missing_selected_endpoint(self):
        with pytest.raises(ValueError, match="Missing Runpod OCR endpoint URL"):
            make_runpod_ocr_client(
                "olm-ocr2",
                {
                    "deepseek-ocr": RunpodOcrEndpointConfig(
                        model="deepseek-ocr",
                        endpoint_url="https://deepseek.test/ocr",
                    ),
                    "olm-ocr2": RunpodOcrEndpointConfig(
                        model="olm-ocr2",
                        endpoint_url=None,
                    ),
                },
            )

    def test_make_runpod_ocr_client_rejects_unknown_model(self):
        with pytest.raises(ValueError, match="Unsupported remote OCR model"):
            make_runpod_ocr_client("other", {})

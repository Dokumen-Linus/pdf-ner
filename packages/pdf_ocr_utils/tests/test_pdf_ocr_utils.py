from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
import pytesseract

from pdf_ocr_utils import (
    OcrConfig,
    PageTextResult,
    PdfiumRenderer,
    TesseractOcrEngine,
    extract_text_from_array,
    extract_text_from_pdf,
    extract_text_from_pdf_by_page,
    render_pdf_page_to_array,
)
from pdf_ocr_utils.exceptions import OcrExecutionError, PdfRenderError


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

        with patch(
            "pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument"
        ) as mock_document:
            mock_document.return_value.__enter__.return_value.__getitem__.return_value = mock_page

            result = render_pdf_page_to_array(Path("sample.pdf"), 0)

        assert result.shape == (2, 3, 3)

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

        with patch(
            "pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument"
        ) as mock_document:
            mock_document.return_value.__enter__.return_value.__iter__.return_value = iter(mock_pages)

            result = list(PdfiumRenderer().iter_pages_to_arrays(Path("sample.pdf")))

        assert [page_index for page_index, _ in result] == [0, 1]
        assert result[0][1].shape == (1, 1, 3)
        assert result[1][1].shape == (1, 2, 3)


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

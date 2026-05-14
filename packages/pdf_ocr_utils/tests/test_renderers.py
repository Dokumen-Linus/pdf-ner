from unittest.mock import patch

import numpy as np
import pytest

from pdf_ocr_utils import (
    PdfiumRenderer,
    RenderConfig,
    extract_text_from_pdf_by_page_via_image_bytes,
    render_pdf_page_to_array,
    render_pdf_page_to_png_bytes,
)
from pdf_ocr_utils.exceptions import PdfRenderError


class TestPdfiumRendererAdditional:
    def test_render_page_to_array_pdf_render_error_with_config(self):
        with patch(
            "pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument",
            side_effect=ValueError("no file"),
        ):
            with pytest.raises(PdfRenderError, match="Failed to render page 0"):
                render_pdf_page_to_array("missing.pdf", 0, render_config=RenderConfig(scale=1.0))

    def test_iter_pages_to_arrays_wraps_exception(self):
        with patch(
            "pdf_ocr_utils.renderers.pdfium.pdfium.PdfDocument",
            side_effect=RuntimeError("corrupt"),
        ):
            with pytest.raises(PdfRenderError, match="Failed to render PDF pages"):
                for _ in PdfiumRenderer().iter_pages_to_arrays("bad.pdf"):
                    pass

    def test_render_page_to_png_bytes_delegates_to_render_page_to_array(self):
        with patch.object(
            PdfiumRenderer, "render_page_to_array", return_value=np.zeros((2, 3, 3), dtype=np.uint8)
        ) as mock_method:
            result = render_pdf_page_to_png_bytes(
                "sample.pdf", 0, render_config=RenderConfig(scale=2.0)
            )
            mock_method.assert_called_once()
            assert result.startswith(b"\x89PNG")

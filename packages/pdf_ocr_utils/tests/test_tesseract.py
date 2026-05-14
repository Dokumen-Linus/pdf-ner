from unittest.mock import patch

import numpy as np
import pytest

from pdf_ocr_utils import OcrConfig, TesseractOcrEngine, extract_text_from_array
from pdf_ocr_utils.exceptions import OcrExecutionError


class TestTesseractAdditional:
    def test_prepare_image_2d(self):
        image = np.zeros((5, 10), dtype=np.uint8)
        prepared = TesseractOcrEngine._prepare_image(image)
        assert prepared.shape == (5, 10)
        assert prepared.flags["C_CONTIGUOUS"]

    def test_prepare_image_non_uint8(self):
        image = np.zeros((3, 4), dtype=np.float64)
        prepared = TesseractOcrEngine._prepare_image(image)
        assert prepared.dtype == np.uint8

    def test_prepare_image_rejects_3d_with_wrong_channels(self):
        image = np.zeros((2, 2, 2), dtype=np.uint8)
        with pytest.raises(ValueError, match="image must have shape"):
            TesseractOcrEngine._prepare_image(image)

    def test_prepare_image_rejects_non_array(self):
        with pytest.raises(TypeError, match="image must be a numpy.ndarray"):
            TesseractOcrEngine._prepare_image("not-an-array")

    def test_extract_text_from_array_without_timeout(self):
        image = np.zeros((2, 2), dtype=np.uint8)
        with patch(
            "pdf_ocr_utils.ocr.tesseract.pytesseract.image_to_string", return_value="text"
        ) as mock_ocr:
            result = TesseractOcrEngine(ocr_config=OcrConfig(timeout=None)).extract_text_from_array(
                image
            )
            assert result == "text"
            assert "timeout" not in mock_ocr.call_args.kwargs

    def test_extract_text_from_image_bytes_rejects_bad_image(self):
        with pytest.raises(OcrExecutionError, match="cannot identify image file"):
            TesseractOcrEngine().extract_text_from_image_bytes(b"not-an-image")

    def test_extract_text_from_image_bytes_wraps_unidentified_image_error(self):
        with pytest.raises(OcrExecutionError):
            TesseractOcrEngine().extract_text_from_image_bytes(b"\x00\x00\x00")

    def test_extract_text_from_array_wraps_oserror(self):
        image = np.zeros((2, 2), dtype=np.uint8)
        with patch(
            "pdf_ocr_utils.ocr.tesseract.pytesseract.image_to_string",
            side_effect=OSError("tesseract not found"),
        ):
            with pytest.raises(OcrExecutionError, match="tesseract not found"):
                extract_text_from_array(image)

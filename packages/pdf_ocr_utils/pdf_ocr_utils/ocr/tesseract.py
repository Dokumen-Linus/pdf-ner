import numpy as np
import pytesseract
from pytesseract import TesseractNotFoundError

from pdf_ocr_utils.exceptions import OcrExecutionError
from pdf_ocr_utils.types import ImageArray, OcrConfig


class TesseractOcrEngine:
    def __init__(self, ocr_config: OcrConfig | None = None) -> None:
        self.ocr_config = ocr_config or OcrConfig()

    def extract_text_from_array(self, image: ImageArray) -> str:
        prepared_image = self._prepare_image(image)
        kwargs: dict[str, str | float] = {
            "lang": self.ocr_config.lang,
            "config": self.ocr_config.config,
        }

        if self.ocr_config.timeout is not None:
            kwargs["timeout"] = self.ocr_config.timeout

        try:
            return pytesseract.image_to_string(prepared_image, **kwargs)
        except (RuntimeError, OSError, TesseractNotFoundError) as exc:
            raise OcrExecutionError(str(exc)) from exc

    @staticmethod
    def _prepare_image(image: np.ndarray) -> ImageArray:
        if not isinstance(image, np.ndarray):
            raise TypeError("image must be a numpy.ndarray")

        if image.dtype != np.uint8:
            image = image.astype(np.uint8, copy=False)

        if image.ndim == 2:
            return np.ascontiguousarray(image)

        if image.ndim == 3 and image.shape[2] in (3, 4):
            if image.shape[2] == 4:
                image = image[:, :, :3]
            return np.ascontiguousarray(image)

        raise ValueError("image must have shape (H, W), (H, W, 3), or (H, W, 4)")


def extract_text_from_array(image: ImageArray, ocr_config: OcrConfig | None = None) -> str:
    return TesseractOcrEngine(ocr_config=ocr_config).extract_text_from_array(image)

import numpy as np
import pypdfium2 as pdfium
from typing import Iterator

from pdf_ocr_utils.exceptions import PdfRenderError
from pdf_ocr_utils.types import ImageArray, PdfSource, RenderConfig


class PdfiumRenderer:
    def __init__(self, render_config: RenderConfig | None = None) -> None:
        self.render_config = render_config or RenderConfig()

    def render_page_to_array(self, pdf_path: PdfSource, page_index: int) -> ImageArray:
        try:
            with pdfium.PdfDocument(str(pdf_path)) as pdf:
                page = pdf[page_index]
                bitmap = page.render(
                    scale=self.render_config.scale,
                    grayscale=self.render_config.grayscale,
                    rev_byteorder=self.render_config.rev_byteorder,
                )
                page_array = bitmap.to_numpy()
        except Exception as exc:
            raise PdfRenderError(f"Failed to render page {page_index} from {pdf_path}") from exc

        return self._normalize_array(page_array)

    def iter_pages_to_arrays(self, pdf_path: PdfSource) -> Iterator[tuple[int, ImageArray]]:
        try:
            with pdfium.PdfDocument(str(pdf_path)) as pdf:
                for page_index, page in enumerate(pdf):
                    bitmap = page.render(
                        scale=self.render_config.scale,
                        grayscale=self.render_config.grayscale,
                        rev_byteorder=self.render_config.rev_byteorder,
                    )
                    page_array = bitmap.to_numpy()
                    yield page_index, self._normalize_array(page_array)
        except Exception as exc:
            raise PdfRenderError(f"Failed to render PDF pages from {pdf_path}") from exc

    @staticmethod
    def _normalize_array(arr: np.ndarray) -> np.ndarray:
        if arr.dtype != np.uint8:
            arr = arr.astype(np.uint8, copy=False)

        if arr.ndim == 3 and arr.shape[2] == 4:
            arr = arr[:, :, :3]

        return np.ascontiguousarray(arr)


def render_pdf_page_to_array(
    pdf_path: PdfSource,
    page_index: int,
    render_config: RenderConfig | None = None,
) -> ImageArray:
    return PdfiumRenderer(render_config=render_config).render_page_to_array(pdf_path, page_index)

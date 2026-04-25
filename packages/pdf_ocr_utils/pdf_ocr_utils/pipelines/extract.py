from collections.abc import Iterable
from typing import Protocol

from pdf_ocr_utils.ocr.tesseract import TesseractOcrEngine
from pdf_ocr_utils.renderers.pdfium import PdfiumRenderer
from pdf_ocr_utils.types import ImageArray, ImageBytes, PageTextResult, PdfSource


class RendererProtocol(Protocol):
    def iter_pages_to_arrays(self, pdf_path: PdfSource) -> Iterable[tuple[int, ImageArray]]: ...


class OcrEngineProtocol(Protocol):
    def extract_text_from_array(self, image: ImageArray) -> str: ...


class ImageBytesRendererProtocol(Protocol):
    def iter_pages_to_png_bytes(self, pdf_path: PdfSource) -> Iterable[tuple[int, ImageBytes]]: ...


class ImageBytesOcrEngineProtocol(Protocol):
    def extract_text_from_image_bytes(self, image: ImageBytes) -> str: ...


def extract_text_from_pdf(
    pdf_path: PdfSource,
    renderer: RendererProtocol | None = None,
    ocr_engine: OcrEngineProtocol | None = None,
    separator: str = "\n\n",
) -> str:
    renderer = renderer or PdfiumRenderer()
    ocr_engine = ocr_engine or TesseractOcrEngine()

    page_texts: list[str] = []
    for _page_index, page_array in renderer.iter_pages_to_arrays(pdf_path):
        text = ocr_engine.extract_text_from_array(page_array)
        page_texts.append(text.strip())

    return separator.join(page_texts).strip()


def extract_text_from_pdf_by_page(
    pdf_path: PdfSource,
    renderer: RendererProtocol | None = None,
    ocr_engine: OcrEngineProtocol | None = None,
) -> list[PageTextResult]:
    renderer = renderer or PdfiumRenderer()
    ocr_engine = ocr_engine or TesseractOcrEngine()

    results: list[PageTextResult] = []
    for page_index, page_array in renderer.iter_pages_to_arrays(pdf_path):
        text = ocr_engine.extract_text_from_array(page_array)
        results.append(PageTextResult(page_index=page_index, text=text))

    return results


def extract_text_from_pdf_via_image_bytes(
    pdf_path: PdfSource,
    renderer: ImageBytesRendererProtocol | None = None,
    ocr_engine: ImageBytesOcrEngineProtocol | None = None,
    separator: str = "\n\n",
) -> str:
    renderer = renderer or PdfiumRenderer()
    ocr_engine = ocr_engine or TesseractOcrEngine()

    page_texts: list[str] = []
    for _page_index, image_bytes in renderer.iter_pages_to_png_bytes(pdf_path):
        text = ocr_engine.extract_text_from_image_bytes(image_bytes)
        page_texts.append(text.strip())

    return separator.join(page_texts).strip()


def extract_text_from_pdf_by_page_via_image_bytes(
    pdf_path: PdfSource,
    renderer: ImageBytesRendererProtocol | None = None,
    ocr_engine: ImageBytesOcrEngineProtocol | None = None,
) -> list[PageTextResult]:
    renderer = renderer or PdfiumRenderer()
    ocr_engine = ocr_engine or TesseractOcrEngine()

    results: list[PageTextResult] = []
    for page_index, image_bytes in renderer.iter_pages_to_png_bytes(pdf_path):
        text = ocr_engine.extract_text_from_image_bytes(image_bytes)
        results.append(PageTextResult(page_index=page_index, text=text))

    return results

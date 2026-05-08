from __future__ import annotations

import os
import tempfile

import anyio
from pdf_ocr_utils import (
    RunpodOcrEndpointConfig,
    TesseractOcrEngine,
    make_runpod_ocr_client,
    render_pdf_page_to_array,
    render_pdf_page_to_png_bytes,
)
from pdfium_utils.annotate import extract_text_by_page as extract_pdfium_text_by_page

from app.core.config import settings

from ..domain.entities import PageOcrText


async def extract_evaluation_pages(
    pdf_bytes: bytes,
    requested_page_count: int,
) -> list[PageOcrText]:
    return await anyio.to_thread.run_sync(
        _extract_evaluation_pages_sync, pdf_bytes, requested_page_count
    )


def _extract_evaluation_pages_sync(
    pdf_bytes: bytes,
    requested_page_count: int,
) -> list[PageOcrText]:
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        pdfium_pages = extract_pdfium_text_by_page(pdf_bytes)
        pdfium_text_by_page = {int(page["page_index"]): str(page["text"]) for page in pdfium_pages}
        page_count = len(pdfium_pages)
        page_indexes = _sample_page_indexes(page_count, requested_page_count)
        tesseract = TesseractOcrEngine()
        olm_client = _make_olm_client()
        try:
            pages: list[PageOcrText] = []
            for page_index in page_indexes:
                pages.append(
                    _extract_page(
                        tmp_path,
                        page_index,
                        pdfium_text_by_page.get(page_index, ""),
                        tesseract,
                        olm_client,
                    )
                )
            return pages
        finally:
            if olm_client is not None:
                olm_client.close()
    finally:
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except FileNotFoundError:
                pass


def _extract_page(
    pdf_path: str,
    page_index: int,
    pdfium_text: str,
    tesseract: TesseractOcrEngine,
    olm_client,
) -> PageOcrText:
    errors: list[str] = []
    tesseract_text = ""
    olm_text: str | None = None

    try:
        page_array = render_pdf_page_to_array(pdf_path, page_index)
        tesseract_text = tesseract.extract_text_from_array(page_array)
    except Exception as exc:
        errors.append(f"tesseract: {type(exc).__name__}: {exc}")

    if olm_client is None:
        errors.append("olm: endpoint unavailable")
    else:
        try:
            image_bytes = render_pdf_page_to_png_bytes(pdf_path, page_index)
            olm_text = olm_client.extract_text_from_image_bytes(image_bytes)
        except Exception as exc:
            errors.append(f"olm: {type(exc).__name__}: {exc}")

    return PageOcrText(
        page_index=page_index,
        pdfium_text=pdfium_text,
        tesseract_text=tesseract_text,
        olm_text=olm_text,
        error_message="; ".join(errors) if errors else None,
    )


def _sample_page_indexes(page_count: int, requested_page_count: int) -> list[int]:
    if page_count <= 0:
        return []
    if requested_page_count >= page_count:
        return list(range(page_count))
    if requested_page_count == 1:
        return [0]
    if requested_page_count == 2:
        return [0, page_count - 1]

    candidates = {0, page_count // 2, page_count - 1}
    if requested_page_count > 3:
        step = max(page_count // requested_page_count, 1)
        for page_index in range(0, page_count, step):
            if len(candidates) >= requested_page_count:
                break
            candidates.add(page_index)
    return sorted(candidates)


def _make_olm_client():
    if not settings.OLM_OCR2_RUNPOD_ENDPOINT_URL:
        return None
    return make_runpod_ocr_client(
        "olm-ocr2",
        {
            "olm-ocr2": RunpodOcrEndpointConfig(
                model="olm-ocr2",
                endpoint_url=settings.OLM_OCR2_RUNPOD_ENDPOINT_URL,
                api_key=settings.RUNPOD_API_KEY,
                timeout=settings.OCR_RUNPOD_TIMEOUT_SECONDS,
                retries=settings.OCR_RUNPOD_RETRIES,
            )
        },
    )

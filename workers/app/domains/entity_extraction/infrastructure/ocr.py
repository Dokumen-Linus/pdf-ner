from __future__ import annotations

import os
import tempfile

import anyio
from pdf_ocr_utils import (
    RunpodOcrEndpointConfig,
    TesseractOcrEngine,
    extract_text_from_pdf_by_page,
    extract_text_from_pdf_by_page_via_image_bytes,
    make_runpod_ocr_client,
)
from pdfium_utils.annotate import extract_text_by_page as extract_pdfium_text_by_page

from app.core.config import settings

from ..domain.value_objects import PageText


def _page_results_to_pages(page_results: list) -> list[PageText]:
    return [
        PageText(
            page_index=int(page.page_index if hasattr(page, "page_index") else page["page_index"]),
            text=str(page.text if hasattr(page, "text") else page["text"]),
        )
        for page in page_results
    ]


async def extract_pdfium_pages(pdf_bytes: bytes) -> list[PageText]:
    return _page_results_to_pages(
        await anyio.to_thread.run_sync(extract_pdfium_text_by_page, pdf_bytes)
    )


async def extract_ocr_pages(pdf_bytes: bytes, ocr_method: str) -> list[PageText]:
    return await anyio.to_thread.run_sync(_extract_ocr_pages_sync, pdf_bytes, ocr_method)


def _extract_ocr_pages_sync(pdf_bytes: bytes, ocr_method: str) -> list[PageText]:
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        if ocr_method == "tesseract":
            return _page_results_to_pages(
                extract_text_from_pdf_by_page(tmp_path, ocr_engine=TesseractOcrEngine())
            )

        remote_model = "deepseek-ocr" if ocr_method == "deepseek" else "olm-ocr2"
        endpoint_configs = {
            "deepseek-ocr": RunpodOcrEndpointConfig(
                model="deepseek-ocr",
                endpoint_url=settings.DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL,
                api_key=settings.RUNPOD_API_KEY,
                timeout=settings.OCR_RUNPOD_TIMEOUT_SECONDS,
                retries=settings.OCR_RUNPOD_RETRIES,
            ),
            "olm-ocr2": RunpodOcrEndpointConfig(
                model="olm-ocr2",
                endpoint_url=settings.OLM_OCR2_RUNPOD_ENDPOINT_URL,
                api_key=settings.RUNPOD_API_KEY,
                timeout=settings.OCR_RUNPOD_TIMEOUT_SECONDS,
                retries=settings.OCR_RUNPOD_RETRIES,
            ),
        }
        ocr_client = make_runpod_ocr_client(remote_model, endpoint_configs)
        try:
            return _page_results_to_pages(
                extract_text_from_pdf_by_page_via_image_bytes(tmp_path, ocr_engine=ocr_client)
            )
        finally:
            ocr_client.close()
    finally:
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except FileNotFoundError:
                pass

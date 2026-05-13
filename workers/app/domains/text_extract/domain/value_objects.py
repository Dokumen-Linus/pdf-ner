from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

OcrMethod = Literal["tesseract", "deepseek-ocr", "olm-ocr2"]
ExtractMethod = Literal["metadata", "pdfium", "tesseract", "deepseek-ocr", "olm-ocr2"]

OCR_METHODS = {"tesseract", "deepseek-ocr", "olm-ocr2"}
EXTRACT_METHODS = {"pdfium", *OCR_METHODS}


@dataclass(frozen=True)
class PageText:
    page_index: int
    text: str


def join_page_text(pages: list[PageText]) -> str:
    return "\n\n".join(page.text.strip() for page in pages).strip()


def has_usable_text(text: str | None) -> bool:
    return bool(text and text.strip())


def text_by_page_payload(pages: list[PageText]) -> dict:
    return {"pages": [{"page_index": page.page_index, "text": page.text} for page in pages]}


def pages_from_text_by_page(payload: dict | None) -> list[PageText]:
    if not isinstance(payload, dict):
        return []
    raw_pages = payload.get("pages")
    if not isinstance(raw_pages, list):
        return []

    pages: list[PageText] = []
    for raw_page in raw_pages:
        if not isinstance(raw_page, dict):
            continue
        try:
            page_index = int(raw_page["page_index"])
        except (KeyError, TypeError, ValueError):
            continue
        pages.append(PageText(page_index=page_index, text=str(raw_page.get("text") or "")))
    return pages


def validate_extract_method(method: str) -> str:
    if method not in EXTRACT_METHODS:
        raise ValueError(f"Unsupported extraction method: {method}")
    return method


def validate_ocr_method(method: str) -> str:
    if method not in OCR_METHODS:
        raise ValueError(f"Unsupported OCR method: {method}")
    return method

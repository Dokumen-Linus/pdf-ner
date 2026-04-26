from dataclasses import dataclass
from typing import Literal

OcrMethod = Literal["tesseract", "deepseek", "olm"]
ExtractMethod = Literal["metadata", "pdfium", "tesseract", "deepseek", "olm"]


@dataclass(frozen=True)
class PageText:
    page_index: int
    text: str


def join_page_text(pages: list[PageText]) -> str:
    return "\n\n".join(page.text.strip() for page in pages).strip()


def has_usable_text(text: str | None) -> bool:
    return bool(text and text.strip())

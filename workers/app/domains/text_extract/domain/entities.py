from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class StoredPdfText:
    pdf_txt_id: UUID
    pdf_id: UUID
    full_text: str
    extract_method: str
    text_by_page: dict | None


@dataclass(frozen=True)
class ExtractionResult:
    pdf_id: UUID
    full_text: str
    text_by_page: dict
    extract_method: str
    pdf_txt_id: UUID | None

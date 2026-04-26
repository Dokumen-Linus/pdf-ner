from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class HighlightRequest(BaseModel):
    pdf_id: UUID
    phrases: dict[str, str] = Field(
        min_length=1,
        description='Mapping of phrase to hex color, e.g. {"hello": "#FF0000"}',
    )
    output_key: str = Field(min_length=1, description="S3 key for the highlighted PDF output")


class ExtractTextRequest(BaseModel):
    pdf_id: UUID
    ocr_model: Literal["deepseek-ocr", "olm-ocr2"]


class ExtractTextResponse(BaseModel):
    pdf_id: UUID
    full_text: str
    text_by_page: dict
    extract_method: str | None
    source: Literal["metadata", "pdfium", "ocr"]
    ocr_model: Literal["deepseek-ocr", "olm-ocr2"] | None = None


@dataclass
class HighlightTask:
    """Subprocess task config for highlighting phrases.

    pdf_bytes is not stored here — it is injected via the parent PdfTask so the
    PDF is serialized only once per subprocess call regardless of how many
    operations are batched.
    """

    phrases: dict[str, str]


@dataclass
class PdfTask:
    """Container for a single PDF and all operations to run in one subprocess call.

    Bundling multiple tasks under one PdfTask means the PDF bytes are pickled
    exactly once when the PdfTask is sent to the worker process.
    """

    pdf_bytes: bytes
    tasks: list[HighlightTask]

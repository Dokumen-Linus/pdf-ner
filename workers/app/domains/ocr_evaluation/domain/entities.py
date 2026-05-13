from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class SampledPdf:
    pdf_id: UUID
    name: str | None
    filepath: str


@dataclass(frozen=True)
class PageOcrText:
    page_index: int
    pdfium_text: str
    tesseract_text: str
    selected_ocr_text: str | None
    selected_ocr_method: str
    error_message: str | None = None


@dataclass(frozen=True)
class SimilarityMetrics:
    normalized_tesseract_length: int
    normalized_selected_length: int
    character_similarity: float | None
    token_overlap: float | None
    length_ratio: float | None
    tesseract_blank: bool
    selected_blank: bool
    score: float | None
    status: str


@dataclass(frozen=True)
class JudgeResult:
    best_method: str
    tesseract_usable: bool
    selected_ocr_usable: bool
    confidence: float
    tesseract_quality: float
    selected_ocr_quality: float
    rationale: str


@dataclass(frozen=True)
class PageEvaluation:
    pdf_id: UUID
    page_index: int
    pdfium_text: str
    tesseract_text: str
    selected_ocr_text: str | None
    selected_ocr_method: str
    similarity: SimilarityMetrics
    judge_result: JudgeResult | None
    recommended_method: str
    error_message: str | None = None


@dataclass(frozen=True)
class EvaluationSummary:
    recommendation: str
    confidence: float
    sampled_pdf_count: int
    sampled_page_count: int
    pdfium_usable_page_ratio: float
    average_tesseract_vs_olm_score: float | None
    average_judge_confidence: float | None
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    details: dict

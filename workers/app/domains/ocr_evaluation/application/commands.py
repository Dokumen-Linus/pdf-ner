from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class EvaluateProjectOcr:
    project_id: UUID
    judge_model: str
    max_pdfs: int = 5
    max_pages_per_pdf: int = 3
    max_cost_usd: Decimal = Decimal("0.50")
    gpu_model: str = "olm-ocr2"
    ocr_only: bool = True
    pdf_ids: list[UUID] | None = None

    def __post_init__(self) -> None:
        if not self.judge_model.strip():
            raise ValueError("judge_model is required")
        if self.max_pdfs <= 0:
            raise ValueError("max_pdfs must be greater than 0")
        if self.max_pages_per_pdf <= 0:
            raise ValueError("max_pages_per_pdf must be greater than 0")
        if self.max_cost_usd <= 0:
            raise ValueError("max_cost_usd must be greater than 0")
        if self.pdf_ids is not None and len(self.pdf_ids) == 0:
            raise ValueError("pdf_ids must not be empty when provided")

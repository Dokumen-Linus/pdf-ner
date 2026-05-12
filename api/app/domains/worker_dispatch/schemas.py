from uuid import UUID

from pydantic import BaseModel, Field


class OptimizePromptRequest(BaseModel):
    project_id: UUID
    template_id: int = Field(gt=0)
    labeled_pdfs: list[UUID] = Field(min_length=1)
    beta: float = Field(default=1.0, gt=0)
    max_cost_usd: float = Field(default=1.0, gt=0)
    ner_chat_model: str = Field(default="gpt-5.4-mini", min_length=1)
    prompt_eng_chat_model: str = Field(default="gpt-5.4-mini", min_length=1)
    convergence_threshold: float = Field(default=0.02, ge=0)


class OcrEvaluationRequest(BaseModel):
    project_id: UUID
    judge_model: str = Field(min_length=1)
    max_pdfs: int = Field(default=5, gt=0)
    max_pages_per_pdf: int = Field(default=3, gt=0)
    max_cost_usd: float = Field(default=0.5, gt=0)

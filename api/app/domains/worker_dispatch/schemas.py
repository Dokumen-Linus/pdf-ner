from uuid import UUID

from pydantic import BaseModel, Field, field_validator

GPU_MODELS = {"deepseek-ocr", "olm-ocr2"}
EXTRACT_METHODS = {"pdfium", "tesseract", "deepseek-ocr", "olm-ocr2"}


class OptimizePromptRequest(BaseModel):
    project_id: UUID
    template_id: int = Field(gt=0)
    labeled_pdfs: list[UUID] = Field(min_length=1)
    beta: float = Field(default=1.0, gt=0)
    max_cost_usd: float = Field(default=1.0, gt=0)
    ner_chat_model: str = Field(default="gpt-5.4-mini", min_length=1)
    prompt_eng_chat_model: str = Field(default="gpt-5.4-mini", min_length=1)
    convergence_threshold: float = Field(default=0.02, ge=0)


class ChatModelEvalRequest(BaseModel):
    project_id: UUID
    pdf_ids: list[UUID] = Field(min_length=1)
    chat_model_ids: list[str] = Field(min_length=1)
    beta: float = Field(default=1.0, gt=0)


class ActivatePromptRequest(BaseModel):
    project_id: UUID
    prompt_id: UUID


class OcrEvaluationRequest(BaseModel):
    project_id: UUID
    judge_model: str = Field(min_length=1)
    max_pdfs: int = Field(default=5, gt=0)
    max_pages_per_pdf: int = Field(default=3, gt=0)
    max_cost_usd: float = Field(default=0.5, gt=0)
    pdf_ids: list[UUID] | None = None
    gpu_model: str = Field(default="olm-ocr2")
    ocr_only: bool = True

    @field_validator("gpu_model")
    @classmethod
    def validate_gpu_model(cls, value: str) -> str:
        if value not in GPU_MODELS:
            raise ValueError("gpu_model is not supported")
        return value


class OcrEvaluationPdfsRequest(OcrEvaluationRequest):
    pdf_ids: list[UUID] = Field(min_length=1)


class ExtractTextBatchRequest(BaseModel):
    project_id: UUID
    pdf_ids: list[UUID] = Field(min_length=1)
    extract_method: str = Field(min_length=1)

    @field_validator("extract_method")
    @classmethod
    def validate_extract_method(cls, value: str) -> str:
        if value not in EXTRACT_METHODS:
            raise ValueError("extract_method is not supported")
        return value

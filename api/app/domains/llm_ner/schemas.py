from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class OptimizePromptRequest(BaseModel):
    project_id: UUID
    max_iterations: int = Field(default=5, ge=1, le=20)
    model: str = Field(default="gpt-4o", min_length=1)


class ExtractEntitiesRequest(BaseModel):
    project_id: UUID
    template_id: int
    document_text: str = Field(default="")
    pdf_id: UUID | None = None
    model: str = Field(min_length=1)
    user_id: UUID | None = None

    @model_validator(mode="after")
    def require_text_or_pdf_id(self) -> "ExtractEntitiesRequest":
        if not self.document_text and self.pdf_id is None:
            raise ValueError("Either document_text or pdf_id must be provided")
        return self

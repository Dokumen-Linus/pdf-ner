from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ExtractEntitiesRequest(BaseModel):
    project_id: UUID
    template_id: int
    document_text: str = Field(min_length=1)
    provider: Literal["anthropic", "gemini", "openai"]
    model: str = Field(min_length=1)

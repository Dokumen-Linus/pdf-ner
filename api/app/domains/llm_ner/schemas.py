from typing import Literal
from uuid import UUID

from pydantic import BaseModel

class ExtractEntitiesRequest(BaseModel):
    project_id: UUID
    template_id: int
    document_text: str
    provider: Literal["anthropic", "gemini", "openai"]
    model: str

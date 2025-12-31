from pydantic import BaseModel
from uuid import UUID

class TemplateTextResponse(BaseModel):
    id: UUID
    text: str

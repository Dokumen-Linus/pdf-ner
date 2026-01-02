from uuid import UUID
from pydantic import BaseModel

class TemplateTextResponse(BaseModel):
    id: UUID
    text: str

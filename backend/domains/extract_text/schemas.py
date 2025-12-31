from pydantic import BaseModel
from uuid import UUID

class ExtractTextResponse(BaseModel):
    pdf_id: UUID
    text: str

from uuid import UUID
from pydantic import BaseModel

class ExtractTextResponse(BaseModel):
    pdf_id: UUID
    text: str

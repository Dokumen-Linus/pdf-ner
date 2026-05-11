from uuid import UUID

from pydantic import BaseModel, Field


class ProcessDocumentSourcePayload(BaseModel):
    source_id: UUID


class ExtractedPagePayload(BaseModel):
    page_index: int = Field(ge=0)
    text: str


class ExtractedTextPayload(BaseModel):
    pages: list[ExtractedPagePayload]

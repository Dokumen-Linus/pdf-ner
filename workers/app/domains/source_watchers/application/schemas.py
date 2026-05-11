from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field


class ProviderCursorPayload(BaseModel):
    value: dict | None = None


class MaterializedDocumentPayload(BaseModel):
    source_id: UUID = Field(validation_alias=AliasChoices("source_id", "document_source_id"))
    pdf_id: UUID
    is_new: bool = False

    @property
    def document_source_id(self) -> UUID:
        return self.source_id


class DiscoveredDocumentPayload(BaseModel):
    external_id: str = Field(min_length=1)
    external_version: str = ""
    uri: str | None = None
    fingerprint: str | None = None
    name: str | None = None
    metadata: dict = Field(default_factory=dict)
    materialized: MaterializedDocumentPayload | None = None


class WatchDiscoveryResult(BaseModel):
    cursor: ProviderCursorPayload
    documents: list[DiscoveredDocumentPayload] = Field(default_factory=list)

from dataclasses import dataclass
from uuid import UUID

from app.shared.domain.DomainEvent import DomainEvent


@dataclass(frozen=True)
class DocumentExtractionQueued(DomainEvent):
    document_source_id: UUID
    optimized_prompt_id: UUID


@dataclass(frozen=True)
class DocumentExtractionCompleted(DomainEvent):
    document_source_id: UUID
    pdf_id: UUID
    run_id: UUID


@dataclass(frozen=True)
class DocumentExtractionFailed(DomainEvent):
    document_source_id: UUID
    pdf_id: UUID
    run_id: UUID
    error_type: str
    error_message: str

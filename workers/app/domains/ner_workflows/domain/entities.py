from dataclasses import dataclass, field
from uuid import UUID

from .value_objects import OcrMethod


@dataclass(frozen=True)
class ProjectExtractionConfig:
    project_id: UUID
    description: str | None
    ocr_method: OcrMethod
    entity_extraction_model: str
    active_prompt_id: UUID | None = None


@dataclass(frozen=True)
class ModelMetadata:
    model_id: str
    provider: str


@dataclass(frozen=True)
class DocumentForExtraction:
    source_id: UUID
    pdf_id: UUID
    project_id: UUID
    full_text: str | None
    ner_workflow_id: UUID | None = None

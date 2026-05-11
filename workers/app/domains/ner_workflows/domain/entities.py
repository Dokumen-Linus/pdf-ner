from dataclasses import dataclass
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
class EntityTypeInfo:
    name: str
    user_definition: str | None
    user_examples: list[str]
    user_format_description: str | None
    datatype: str | None
    single_word: bool | None
    exact_length: int | None
    unique: bool
    required: bool
    std_definition: str | None = None
    std_examples: list[str] | None = None
    std_format_description: str | None = None
    std_regex: str | None = None
    entity_type_id: UUID | None = None

    @property
    def best_definition(self) -> str:
        return self.user_definition or self.std_definition or ""

    @property
    def all_examples(self) -> list[str]:
        seen: set[str] = set()
        values: list[str] = []
        for example in self.user_examples + (self.std_examples or []):
            if example not in seen:
                seen.add(example)
                values.append(example)
        return values


@dataclass(frozen=True)
class DocumentForExtraction:
    source_id: UUID
    pdf_id: UUID
    project_id: UUID
    full_text: str | None
    ner_workflow_id: UUID | None = None

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from .value_objects import F1Score


@dataclass
class EntityTypeInfo:
    """Merged entity type info from web.entity_types + api.std_entity_types."""

    name: str
    user_definition: str | None
    user_examples: list[str]
    user_format_description: str | None
    datatype: str | None  # 'int', 'float', 'alphanumeric', 'alpha'
    single_word: bool | None
    exact_length: int | None
    unique: bool
    required: bool
    # From std_entity_types (if linked)
    std_definition: str | None = None
    std_examples: list[str] = field(default_factory=list)
    std_format_description: str | None = None
    std_regex: str | None = None

    @property
    def best_definition(self) -> str:
        return self.user_definition or self.std_definition or ""

    @property
    def all_examples(self) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for ex in self.user_examples + self.std_examples:
            if ex not in seen:
                seen.add(ex)
                result.append(ex)
        return result


@dataclass
class LabeledAnnotation:
    """A single labeled entity from web.annotations."""

    pdf_id: UUID
    entity_type_name: str  # custom_entity_type
    labeled_text: str  # contents
    page_index: int


@dataclass
class LabeledPdf:
    """A PDF with its extracted text and ground-truth labels."""

    pdf_id: UUID
    full_text: str
    text_by_page: dict | None
    annotations: list[LabeledAnnotation]

    @property
    def ground_truth(self) -> dict[str, list[str]]:
        """Group annotations by entity type name -> list of labeled texts."""
        result: dict[str, list[str]] = {}
        for ann in self.annotations:
            result.setdefault(ann.entity_type_name, []).append(ann.labeled_text)
        return result


@dataclass
class PromptCandidate:
    """A prompt being evaluated in the optimization loop."""

    system_prompt: str
    iteration: int
    scores: dict[str, F1Score] | None = None
    overall_f1: float | None = None
    error_analysis: str | None = None


@dataclass
class EvaluationResult:
    """Full evaluation of one prompt against all labeled PDFs."""

    prompt_candidate: PromptCandidate
    per_entity_scores: dict[str, F1Score]
    overall_exact_match_rate: float
    overall_partial_match_rate: float
    overall_f1: float
    errors: list[EntityMatch]  # only mismatches

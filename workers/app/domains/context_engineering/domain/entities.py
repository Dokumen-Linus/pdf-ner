from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from .value_objects import EntityMatch, F1Score


@dataclass(frozen=True)
class EntityTypeInfo:
    """Merged entity type info from web.entity_types + public.std_entity_types."""

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
    entity_type_id: UUID | None = None

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
    entity_type_id: UUID | None = None
    entity_value_id: UUID | None = None


@dataclass
class LabeledPdf:
    """A PDF with its extracted text and ground-truth labels."""

    pdf_id: UUID
    full_text: str | None
    text_by_page: dict | None
    annotations: list[LabeledAnnotation]
    bucket_id: UUID | None = None
    filepath: str | None = None
    pdf_txt_id: UUID | None = None

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
    examples: list[PromptExampleSnapshot] = field(default_factory=list)
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


@dataclass(frozen=True)
class FinalPredictionPair:
    """One final-run label/prediction row for persistence."""

    pdf_id: UUID
    entity_type_id: UUID
    labelled_value: str | None
    predicted_value: str | None


@dataclass(frozen=True)
class PromptExampleSnapshot:
    """A labeled PDF snapshot copied into the final prompt as an example."""

    pdf_id: UUID
    example_order: int
    text_excerpt: str
    labelled_entities: dict[str, str | list[str]]


@dataclass(frozen=True)
class FinalPdfEvaluation:
    """Final prompt evaluation and persistence rows for one PDF."""

    pdf_id: UUID
    is_fully_correct: bool
    pairs: list[FinalPredictionPair]
    entity_matches: dict[str, bool]
    labelled_counts: dict[str, int]
    matched_counts: dict[str, int]
    false_positive_counts: dict[str, int]
    false_negative_counts: dict[str, int]

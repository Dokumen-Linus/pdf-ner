from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from .value_objects import FScore


@dataclass(frozen=True)
class LabelValue:
    pdf_id: UUID
    entity_type_id: UUID
    entity_type_name: str
    text_value: str


@dataclass(frozen=True)
class MetricsResult:
    overall_f: float
    per_entity_scores: dict[str, FScore]
    num_correct_pdfs: int
    accuracy_score: float | None
    entity_type_metrics: dict[str, dict[str, float]]
    incorrectly_predicted_entity_value_ids: list[UUID] = field(default_factory=list)
    missed_entity_types: list[dict] = field(default_factory=list)

    @property
    def pdf_accuracy(self) -> float | None:
        return self.accuracy_score


@dataclass(frozen=True)
class PersistedPredictionLike:
    entity_value_id: UUID
    pdf_id: UUID
    entity_type_id: UUID
    text_value: str


@dataclass(frozen=True)
class PdfResultLike:
    pdf_id: UUID
    predictions: dict
    persisted_predictions: list[PersistedPredictionLike] = field(default_factory=list)

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class PredictedEntityValue:
    entity_value_id: int
    pdf_id: UUID
    text_value: str
    subtype: str
    color: str
    opacity: float


@dataclass(frozen=True)
class AnnotationSummary:
    requested: int
    matched: int
    not_found: int
    updated: int
    pdfs_changed: int

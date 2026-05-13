from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class CreatePredictedEntityAnnotations:
    ner_run_id: UUID
    overwrite: bool = False

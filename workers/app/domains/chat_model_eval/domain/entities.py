from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ProjectModelEvalConfig:
    project_id: UUID
    active_prompt_id: UUID


@dataclass(frozen=True)
class ModelMetadata:
    model_id: str
    provider: str


@dataclass(frozen=True)
class ModelEvalIterationResult:
    iteration_id: UUID
    ner_run_id: UUID | None
    model_id: str
    overall_f: float
    accuracy_score: float | None
    cost_usd: str

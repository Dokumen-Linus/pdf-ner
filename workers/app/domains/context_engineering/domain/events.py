from dataclasses import dataclass
from uuid import UUID

from app.shared.domain.DomainEvent import DomainEvent


@dataclass(frozen=True)
class PromptOptimizationCompleted(DomainEvent):
    project_id: UUID
    best_prompt_id: UUID
    best_f1: float
    iterations_run: int


@dataclass(frozen=True)
class EvaluationRoundCompleted(DomainEvent):
    project_id: UUID
    iteration: int
    overall_f1: float

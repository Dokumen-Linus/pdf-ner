from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class OptimizePrompt:
    project_id: UUID
    max_iterations: int = 5
    convergence_threshold: float = 0.02  # stop if F1 improvement < this
    model: str = "gpt-4o"
    refinement_model: str = "gpt-4o"

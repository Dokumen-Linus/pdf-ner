from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class OptimizePrompt:
    project_id: UUID
    template_id: int
    max_cost_usd: Decimal = Decimal("1.00")
    convergence_threshold: float = 0.02  # stop if F1 improvement < this
    model: str = "gpt-4o"
    refinement_model: str = "gpt-4o"

    def __post_init__(self) -> None:
        if self.template_id <= 0:
            raise ValueError("template_id must be greater than 0")
        if self.max_cost_usd <= 0:
            raise ValueError("max_cost_usd must be greater than 0")

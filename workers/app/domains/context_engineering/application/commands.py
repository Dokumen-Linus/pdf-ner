from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class OptimizePrompt:
    project_id: UUID
    template_id: int
    labeled_pdfs: list[UUID]
    beta: float = 1.0
    max_cost_usd: Decimal = Decimal("1.00")
    convergence_threshold: float = 0.02  # stop if F1 improvement < this
    ner_chat_model: str = "gpt-5.4-mini"
    prompt_eng_chat_model: str = "gpt-5.4-mini"

    def __post_init__(self) -> None:
        if self.template_id <= 0:
            raise ValueError("template_id must be greater than 0")
        if not self.labeled_pdfs:
            raise ValueError("labeled_pdfs must not be empty")
        if self.beta <= 0:
            raise ValueError("beta must be greater than 0")
        if self.max_cost_usd <= 0:
            raise ValueError("max_cost_usd must be greater than 0")
        if self.convergence_threshold < 0:
            raise ValueError("convergence_threshold must be non-negative")

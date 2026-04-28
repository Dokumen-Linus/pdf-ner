from dataclasses import dataclass
from decimal import Decimal


@dataclass
class CostBudget:
    max_cost_usd: Decimal
    spent_cost_usd: Decimal = Decimal("0")

    def __post_init__(self) -> None:
        if self.max_cost_usd <= 0:
            raise ValueError("max_cost_usd must be greater than 0")
        if self.spent_cost_usd < 0:
            raise ValueError("spent_cost_usd must not be negative")

    @property
    def is_exhausted(self) -> bool:
        return self.spent_cost_usd >= self.max_cost_usd

    @property
    def remaining_cost_usd(self) -> Decimal:
        remaining = self.max_cost_usd - self.spent_cost_usd
        return max(remaining, Decimal("0"))

    def add_usage(self, cost_usd: Decimal) -> None:
        if cost_usd < 0:
            raise ValueError("cost_usd must not be negative")
        self.spent_cost_usd += cost_usd


@dataclass(frozen=True)
class F1Score:
    precision: float
    recall: float
    f1: float

    def __post_init__(self):
        for field_name in ("precision", "recall", "f1"):
            val = getattr(self, field_name)
            if not 0.0 <= val <= 1.0:
                raise ValueError(f"{field_name} must be between 0 and 1, got {val}")


@dataclass(frozen=True)
class EntityMatch:
    """Result of comparing a single predicted value against ground truth."""

    entity_type_name: str
    predicted: str | None
    ground_truth: str | None
    is_exact_match: bool
    is_partial_match: bool

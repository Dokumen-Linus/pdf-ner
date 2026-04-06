from dataclasses import dataclass


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

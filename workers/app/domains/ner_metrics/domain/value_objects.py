from dataclasses import dataclass


@dataclass(frozen=True)
class FScore:
    precision: float
    recall: float
    f: float

    def __post_init__(self) -> None:
        for field_name in ("precision", "recall", "f"):
            value = getattr(self, field_name)
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{field_name} must be between 0 and 1, got {value}")

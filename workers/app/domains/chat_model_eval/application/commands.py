from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class EvaluateChatModels:
    project_id: UUID
    pdf_ids: list[UUID]
    chat_model_ids: list[str]
    beta: float = 1.0

    def __post_init__(self) -> None:
        if not self.pdf_ids:
            raise ValueError("pdf_ids must not be empty")
        if not self.chat_model_ids:
            raise ValueError("chat_model_ids must not be empty")
        if self.beta <= 0:
            raise ValueError("beta must be greater than 0")

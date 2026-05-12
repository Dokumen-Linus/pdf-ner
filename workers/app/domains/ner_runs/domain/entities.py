from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class EntityTypeInfo:
    name: str
    user_definition: str | None
    user_examples: list[str]
    user_format_description: str | None
    datatype: str | None
    single_word: bool | None
    exact_length: int | None
    unique: bool
    required: bool
    std_definition: str | None = None
    std_examples: list[str] = field(default_factory=list)
    std_format_description: str | None = None
    std_regex: str | None = None
    entity_type_id: UUID | None = None

    @property
    def best_definition(self) -> str:
        return self.user_definition or self.std_definition or ""

    @property
    def all_examples(self) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for example in self.user_examples + (self.std_examples or []):
            if example not in seen:
                seen.add(example)
                result.append(example)
        return result


@dataclass(frozen=True)
class NerRunOrigin:
    ner_workflow_id: UUID | None = None
    context_eng_iter_id: UUID | None = None
    model_eval_iter_id: UUID | None = None

    def __post_init__(self) -> None:
        origins = [
            self.ner_workflow_id,
            self.context_eng_iter_id,
            self.model_eval_iter_id,
        ]
        if sum(origin is not None for origin in origins) > 1:
            raise ValueError("only one ner run origin may be set")


@dataclass(frozen=True)
class NerPdfInput:
    pdf_id: UUID
    text: str
    pdf_txt_id: UUID | None = None


@dataclass(frozen=True)
class PersistedPrediction:
    entity_value_id: UUID
    pdf_id: UUID
    entity_type_id: UUID
    text_value: str


@dataclass(frozen=True)
class NerPdfResult:
    pdf_id: UUID
    predictions: dict
    persisted_predictions: list[PersistedPrediction] = field(default_factory=list)


@dataclass(frozen=True)
class NerBatchResult:
    run_id: UUID | None
    pdf_results: list[NerPdfResult]
    cost_usd: Decimal
    input_tokens: int
    output_tokens: int

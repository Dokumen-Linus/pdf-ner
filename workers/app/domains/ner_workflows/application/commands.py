from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ProcessDocumentSource:
    document_source_id: UUID
    optimized_prompt_id: UUID

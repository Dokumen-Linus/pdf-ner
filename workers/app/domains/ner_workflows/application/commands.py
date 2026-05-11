from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ProcessDocumentSource:
    source_id: UUID

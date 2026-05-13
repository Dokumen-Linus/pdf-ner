from dataclasses import dataclass
from uuid import UUID

from ..domain.value_objects import validate_extract_method


@dataclass(frozen=True)
class ExtractMissingPdfTexts:
    project_id: UUID
    pdf_ids: list[UUID]
    extract_method: str

    def __post_init__(self) -> None:
        if not self.pdf_ids:
            raise ValueError("pdf_ids must not be empty")
        validate_extract_method(self.extract_method)

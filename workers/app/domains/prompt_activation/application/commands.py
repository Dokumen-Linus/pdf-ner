from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ActivateProjectPrompt:
    project_id: UUID
    prompt_id: UUID

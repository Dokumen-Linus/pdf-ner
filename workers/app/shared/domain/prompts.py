from __future__ import annotations

from dataclasses import dataclass, field
import json
from uuid import UUID

SUPPORTED_PLACEHOLDERS = {
    "<PROJECT_DESCRIPTION>",
    "<ENTITY_TYPES>",
    "<DEFINITIONS>",
    "<EXAMPLE_VALUES>",
    "<EXAMPLE_FINDS>",
    "<REGEX>",
    "<IS_REQUIRED>",
    "<IS_UNIQUE>",
}


@dataclass(frozen=True)
class PromptEntityMetadata:
    entity_type_id: UUID
    name: str
    definition: str | None
    example_values: list[str] = field(default_factory=list)
    example_finds: list[dict] = field(default_factory=list)
    regex: str | None = None
    required: bool = False
    unique: bool = False


def _json_array(values: list) -> str:
    return json.dumps(values, ensure_ascii=True)


def form_prompt_text(
    template_text: str,
    *,
    project_description: str | None,
    entity_types: list[PromptEntityMetadata],
) -> str:
    names = [entity.name for entity in entity_types]
    definitions = [entity.definition or "" for entity in entity_types]
    example_values = [entity.example_values for entity in entity_types]
    example_finds = [entity.example_finds for entity in entity_types]
    regex = [entity.regex for entity in entity_types]
    required = [entity.required for entity in entity_types]
    unique = [entity.unique for entity in entity_types]

    rendered = template_text
    rendered = rendered.replace("<PROJECT_DESCRIPTION>", project_description or "")
    rendered = rendered.replace("<ENTITY_TYPES>", _json_array(names))
    rendered = rendered.replace("<DEFINITIONS>", _json_array(definitions))
    rendered = rendered.replace("<EXAMPLE_VALUES>", _json_array(example_values))
    rendered = rendered.replace("<EXAMPLE_FINDS>", _json_array(example_finds))
    rendered = rendered.replace("<REGEX>", _json_array(regex))
    rendered = rendered.replace("<IS_REQUIRED>", _json_array(required))
    rendered = rendered.replace("<IS_UNIQUE>", _json_array(unique))

    # Legacy templates used this placeholder, but constraints now live in the
    # aligned metadata lists above.
    return rendered.replace("<CONSTRAINTS>", "")

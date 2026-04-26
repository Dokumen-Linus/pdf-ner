from __future__ import annotations

from .entities import EntityTypeInfo, ProjectExtractionConfig


def build_json_schema(entity_types: list[EntityTypeInfo]) -> dict:
    properties = {entity.name: _entity_type_to_property(entity) for entity in entity_types}
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def build_fallback_system_prompt(
    project: ProjectExtractionConfig,
    entity_types: list[EntityTypeInfo],
) -> str:
    sections = [
        "You are a precise named entity recognition system. Extract structured entities "
        "from the provided document text and return only JSON."
    ]
    if project.description:
        sections.append(f"Document type:\n{project.description}")

    fields: list[str] = []
    for entity in entity_types:
        field = [f"Field: {entity.name}"]
        if entity.best_definition:
            field.append(f"Definition: {entity.best_definition}")
        if entity.all_examples:
            field.append(f"Examples: {', '.join(entity.all_examples[:5])}")
        constraints = _constraint_text(entity)
        if constraints:
            field.append(f"Constraints: {constraints}")
        field.append("Cardinality: one value" if entity.unique else "Cardinality: array")
        field.append("Required: yes" if entity.required else "Required: no")
        fields.append("\n".join(field))

    sections.append("Entity fields:\n\n" + "\n\n".join(fields))
    return "\n\n".join(sections)


def _entity_type_to_property(entity: EntityTypeInfo) -> dict:
    json_type = _datatype_to_json_type(entity.datatype)
    if entity.unique:
        prop: dict = {"type": json_type if entity.required else [json_type, "null"]}
    else:
        prop = {"type": "array", "items": {"type": json_type}}
    if entity.best_definition:
        prop["description"] = entity.best_definition
    return prop


def _datatype_to_json_type(datatype: str | None) -> str:
    return {
        "int": "integer",
        "float": "number",
        "alphanumeric": "string",
        "alpha": "string",
    }.get(datatype, "string")


def _constraint_text(entity: EntityTypeInfo) -> str:
    parts: list[str] = []
    if entity.datatype:
        parts.append(f"datatype={entity.datatype}")
    if entity.single_word:
        parts.append("single word only")
    if entity.exact_length:
        parts.append(f"exactly {entity.exact_length} characters")
    if entity.std_regex:
        parts.append(f"pattern: {entity.std_regex}")
    return ", ".join(parts)


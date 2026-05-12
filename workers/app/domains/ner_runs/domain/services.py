from __future__ import annotations

from .entities import EntityTypeInfo
from .value_objects import FScore


def build_json_schema(entity_types: list[EntityTypeInfo]) -> dict:
    properties = {entity.name: _entity_type_to_property(entity) for entity in entity_types}
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def build_fallback_system_prompt(
    project_description: str | None,
    entity_types: list[EntityTypeInfo],
) -> str:
    sections = [
        "You are a precise named entity recognition system. Extract structured entities "
        "from the provided document text and return only JSON."
    ]
    if project_description:
        sections.append(f"Document type:\n{project_description}")

    fields: list[str] = []
    for entity in entity_types:
        field = [f"Field: {entity.name}"]
        if entity.best_definition:
            field.append(f"Definition: {entity.best_definition}")
        if entity.all_examples:
            field.append(f"Examples: {', '.join(entity.all_examples[:5])}")
        constraints = build_constraint_text(entity)
        if constraints:
            field.append(f"Constraints: {constraints}")
        field.append("Cardinality: one value" if entity.unique else "Cardinality: array")
        field.append("Required: yes" if entity.required else "Required: no")
        fields.append("\n".join(field))

    sections.append("Entity fields:\n\n" + "\n\n".join(fields))
    return "\n\n".join(sections)


def normalise_prediction_values(raw_value) -> list[str]:
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return [normalised for value in raw_value if (normalised := str(value).strip())]
    normalised = str(raw_value).strip()
    return [normalised] if normalised else []


def calculate_f_score(
    predicted_values: list[str],
    labelled_values: list[str],
    *,
    beta: float,
) -> FScore:
    pred = [value.strip() for value in predicted_values if value.strip()]
    labels = [value.strip() for value in labelled_values if value.strip()]
    tp = _count_exact_matches(pred, labels)
    precision = tp / len(pred) if pred else (1.0 if not labels else 0.0)
    recall = tp / len(labels) if labels else (1.0 if not pred else 0.0)
    beta_sq = beta * beta
    denominator = (beta_sq * precision) + recall
    f_score = ((1 + beta_sq) * precision * recall / denominator) if denominator > 0 else 0.0
    return FScore(precision=precision, recall=recall, f=f_score)


def build_constraint_text(entity: EntityTypeInfo) -> str:
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


def exact_match(a: str, b: str) -> bool:
    return a.lower().strip() == b.lower().strip()


def _count_exact_matches(predicted: list[str], labelled: list[str]) -> int:
    count = 0
    remaining = list(labelled)
    for predicted_value in predicted:
        for index, labelled_value in enumerate(remaining):
            if exact_match(predicted_value, labelled_value):
                count += 1
                remaining.pop(index)
                break
    return count

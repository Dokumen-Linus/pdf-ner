from __future__ import annotations
import json

from .entities import EntityTypeInfo, EvaluationResult, LabeledPdf, PromptCandidate
from .value_objects import EntityMatch, F1Score

# ─── 1. JSON Schema Builder ────────────────────────────────────────────


def build_json_schema(entity_types: list[EntityTypeInfo]) -> dict:
    """Build an OpenAI-compatible JSON Schema from entity type definitions.

    Enforces additionalProperties: false for OpenAI strict mode.
    All properties listed in required (non-required fields are nullable).
    """
    properties = {}
    for et in entity_types:
        properties[et.name] = _entity_type_to_json_property(et)

    return {
        "type": "object",
        "properties": properties,
        "required": list(properties.keys()),
        "additionalProperties": False,
    }


def _entity_type_to_json_property(et: EntityTypeInfo) -> dict:
    base_type = _datatype_to_json_type(et.datatype)

    if et.unique:
        if et.required:
            prop: dict = {"type": base_type}
        else:
            prop = {"type": [base_type, "null"]}
    else:
        prop = {
            "type": "array",
            "items": {"type": base_type},
        }

    if et.best_definition:
        prop["description"] = et.best_definition

    return prop


def _datatype_to_json_type(datatype: str | None) -> str:
    mapping = {
        "int": "integer",
        "float": "number",
        "alphanumeric": "string",
        "alpha": "string",
    }
    return mapping.get(datatype, "string")


# ─── 2. Prompt Engineering ──────────────────────────────────────────────


def build_base_system_prompt(
    project_description: str | None,
    entity_types: list[EntityTypeInfo],
) -> str:
    """Construct the initial system prompt from entity type metadata."""
    sections = [
        "You are a precise named entity recognition (NER) system. "
        "Extract structured entities from the provided document text. "
        "Return a JSON object with the specified fields."
    ]

    if project_description:
        sections.append(f"## Document Type\n{project_description}")

    sections.append("## Entity Fields to Extract\n")
    for et in entity_types:
        field_desc = f"### {et.name}"
        if et.best_definition:
            field_desc += f"\nDefinition: {et.best_definition}"
        if et.all_examples:
            field_desc += f"\nExamples: {', '.join(et.all_examples[:5])}"
        fmt = et.user_format_description or et.std_format_description
        if fmt:
            field_desc += f"\nFormat: {fmt}"
        constraints = _build_constraint_text(et)
        if constraints:
            field_desc += f"\nConstraints: {constraints}"
        if et.unique:
            field_desc += "\nCardinality: exactly one value (unique)"
        else:
            field_desc += "\nCardinality: may appear multiple times (return as array)"
        if et.required:
            field_desc += "\nThis field is REQUIRED. You must extract a value."
        else:
            field_desc += "\nThis field is OPTIONAL. Set to null if not found."
        sections.append(field_desc)

    sections.append(
        "## Output Format\nRespond with a single JSON object. Do not include markdown formatting."
    )

    return "\n\n".join(sections)


def _build_constraint_text(et: EntityTypeInfo) -> str:
    parts: list[str] = []
    if et.datatype:
        parts.append(f"datatype={et.datatype}")
    if et.single_word:
        parts.append("single word only")
    if et.exact_length:
        parts.append(f"exactly {et.exact_length} characters")
    if et.std_regex:
        parts.append(f"pattern: {et.std_regex}")
    return ", ".join(parts)


def format_few_shot_examples(
    labeled_pdfs: list[LabeledPdf],
    max_examples: int = 3,
) -> str:
    """Format labeled annotations as few-shot examples for the prompt."""
    if not labeled_pdfs:
        return ""

    examples = []
    for pdf in labeled_pdfs[:max_examples]:
        ground_truth = pdf.ground_truth
        example_output: dict[str, str | list[str]] = {}
        for entity_name, values in ground_truth.items():
            if len(values) == 1:
                example_output[entity_name] = values[0]
            else:
                example_output[entity_name] = values

        doc_text = pdf.full_text[:2000] + ("..." if len(pdf.full_text) > 2000 else "")

        examples.append(
            f"### Example Document:\n{doc_text}\n\n"
            f"### Expected Output:\n{json.dumps(example_output, indent=2)}"
        )

    return "## Few-Shot Examples\n\n" + "\n\n---\n\n".join(examples)


def generate_prompt_variants(
    base_prompt: str,
    entity_types: list[EntityTypeInfo],
    project_description: str | None,
) -> list[str]:
    """Generate 3 prompt variants with different instruction styles.

    Variant 0: Base prompt (structured, field-by-field)
    Variant 1: Concise style (shorter instructions, emphasis on precision)
    Variant 2: Chain-of-thought style (asks model to reason before answering)
    """
    variants = [base_prompt]

    # Variant 1: Concise
    field_list = ", ".join(et.name for et in entity_types)
    concise = f"Extract these fields from the document: {field_list}.\n"
    concise += (
        "Return JSON. Required fields must have values; optional fields are null if missing.\n"
    )
    if project_description:
        concise += f"Document type: {project_description}\n"
    for et in entity_types:
        constraint = _build_constraint_text(et)
        concise += f"- {et.name}: {et.best_definition}"
        if constraint:
            concise += f" ({constraint})"
        concise += "\n"
    variants.append(concise)

    # Variant 2: Chain-of-thought
    cot = (
        base_prompt + "\n\n" + "## Extraction Strategy\n"
        "Before producing your final JSON output, mentally:\n"
        "1. Read the entire document\n"
        "2. For each field, identify candidate text spans\n"
        "3. Verify each candidate against the field's constraints\n"
        "4. Select the best match or null if no valid candidate exists\n"
        "Then output the JSON."
    )
    variants.append(cot)

    return variants


def build_refinement_prompt(
    current_prompt: str,
    error_analysis: str,
    entity_types: list[EntityTypeInfo],
) -> str:
    """Build a meta-prompt asking an LLM to refine the NER system prompt."""
    entity_names = ", ".join(et.name for et in entity_types)
    return (
        "You are a prompt engineering expert. Below is a system prompt used for "
        "named entity recognition, followed by an analysis of errors it produced.\n\n"
        f"## Current System Prompt\n{current_prompt}\n\n"
        f"## Error Analysis\n{error_analysis}\n\n"
        f"## Entity Types\n{entity_names}\n\n"
        "## Task\n"
        "Write an improved version of the system prompt that addresses the errors. "
        "Keep the same JSON output format. Only output the improved system prompt text, "
        "nothing else."
    )


# ─── 3. Evaluation ─────────────────────────────────────────────────────


def evaluate_predictions(
    predicted: dict,
    ground_truth: dict[str, list[str]],
    entity_types: list[EntityTypeInfo],
) -> EvaluationResult:
    """Compare LLM predictions against ground truth annotations."""
    per_entity_scores: dict[str, F1Score] = {}
    all_matches: list[EntityMatch] = []
    errors: list[EntityMatch] = []

    for et in entity_types:
        gt_values = ground_truth.get(et.name, [])
        pred_raw = predicted.get(et.name)

        # Normalize predictions to list of strings
        if pred_raw is None:
            pred_values: list[str] = []
        elif isinstance(pred_raw, list):
            pred_values = [str(v) for v in pred_raw if v is not None]
        else:
            pred_values = [str(pred_raw)]

        gt_normalized = [v.strip() for v in gt_values]
        pred_normalized = [v.strip() for v in pred_values]

        exact_tp, partial_tp = _count_matches(pred_normalized, gt_normalized)

        precision = (
            exact_tp / len(pred_normalized)
            if pred_normalized
            else (1.0 if not gt_normalized else 0.0)
        )
        recall = (
            exact_tp / len(gt_normalized)
            if gt_normalized
            else (1.0 if not pred_normalized else 0.0)
        )
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        per_entity_scores[et.name] = F1Score(precision=precision, recall=recall, f1=f1)

        for pred_v in pred_normalized:
            is_exact = any(_exact_match(pred_v, gt_v) for gt_v in gt_normalized)
            is_partial = any(_partial_match(pred_v, gt_v) for gt_v in gt_normalized)
            match = EntityMatch(
                entity_type_name=et.name,
                predicted=pred_v,
                ground_truth=None,
                is_exact_match=is_exact,
                is_partial_match=is_partial,
            )
            all_matches.append(match)
            if not is_exact:
                errors.append(match)

    total_entities = len(entity_types)
    if total_entities > 0:
        overall_f1 = sum(s.f1 for s in per_entity_scores.values()) / total_entities
        overall_exact = sum(1 for m in all_matches if m.is_exact_match) / max(len(all_matches), 1)
        overall_partial = sum(1 for m in all_matches if m.is_partial_match) / max(
            len(all_matches), 1
        )
    else:
        overall_f1 = 0.0
        overall_exact = 0.0
        overall_partial = 0.0

    return EvaluationResult(
        prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
        per_entity_scores=per_entity_scores,
        overall_exact_match_rate=overall_exact,
        overall_partial_match_rate=overall_partial,
        overall_f1=overall_f1,
        errors=errors,
    )


def build_error_analysis(
    results: list[EvaluationResult],
    entity_types: list[EntityTypeInfo],
) -> str:
    """Summarize evaluation errors into a text block for prompt refinement."""
    lines: list[str] = []
    for et in entity_types:
        et_errors: list[EntityMatch] = []
        for result in results:
            et_errors.extend(e for e in result.errors if e.entity_type_name == et.name)
        if et_errors:
            lines.append(f"### {et.name} ({len(et_errors)} errors)")
            for err in et_errors[:5]:
                lines.append(f"  - Predicted: {err.predicted!r}")
            score_vals = [
                r.per_entity_scores[et.name] for r in results if et.name in r.per_entity_scores
            ]
            if score_vals:
                avg_f1 = sum(s.f1 for s in score_vals) / len(score_vals)
                lines.append(f"  Average F1: {avg_f1:.3f}")
    return "\n".join(lines)


def _exact_match(a: str, b: str) -> bool:
    return a.lower().strip() == b.lower().strip()


def _partial_match(a: str, b: str) -> bool:
    a_lower, b_lower = a.lower().strip(), b.lower().strip()
    return a_lower in b_lower or b_lower in a_lower


def _count_matches(predicted: list[str], ground_truth: list[str]) -> tuple[int, int]:
    """Count exact and partial matches. Each GT value matched at most once."""
    exact = 0
    partial = 0
    gt_remaining = list(ground_truth)

    for pred in predicted:
        for i, gt in enumerate(gt_remaining):
            if _exact_match(pred, gt):
                exact += 1
                partial += 1
                gt_remaining.pop(i)
                break
        else:
            for i, gt in enumerate(gt_remaining):
                if _partial_match(pred, gt):
                    partial += 1
                    gt_remaining.pop(i)
                    break

    return exact, partial

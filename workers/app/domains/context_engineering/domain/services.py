from __future__ import annotations

import json

from .entities import (
    EntityTypeInfo,
    EvaluationResult,
    FinalPdfEvaluation,
    FinalPredictionPair,
    LabeledPdf,
    PromptCandidate,
    PromptExampleSnapshot,
)
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


def render_prompt_template(
    template_txt: str,
    project_description: str | None,
    entity_types: list[EntityTypeInfo],
) -> str:
    """Render a public template using the same placeholders as API extraction."""
    names = [et.name for et in entity_types]
    definitions = [et.best_definition for et in entity_types]
    examples = [et.all_examples for et in entity_types]
    constraints = [_build_constraint_text(et) for et in entity_types]
    is_required = [et.required for et in entity_types]
    is_unique = [et.unique for et in entity_types]

    prompt = template_txt
    prompt = prompt.replace("<PROJECT_DESCRIPTION>", project_description or "")
    prompt = prompt.replace("<ENTITY_TYPES>", str(names))
    prompt = prompt.replace("<DEFINITIONS>", str(definitions))
    prompt = prompt.replace("<EXAMPLE_VALUES>", str(examples))
    prompt = prompt.replace("<CONSTRAINTS>", str(constraints))
    prompt = prompt.replace("<IS_REQUIRED>", str(is_required))
    prompt = prompt.replace("<IS_UNIQUE>", str(is_unique))
    return prompt


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
    return format_prompt_example_snapshots(
        build_prompt_example_snapshots(labeled_pdfs, max_examples=max_examples)
    )


def build_prompt_example_snapshots(
    labeled_pdfs: list[LabeledPdf],
    max_examples: int = 3,
    max_chars_per_example: int = 2000,
) -> list[PromptExampleSnapshot]:
    if not labeled_pdfs:
        return []

    snapshots: list[PromptExampleSnapshot] = []
    for index, pdf in enumerate(labeled_pdfs[:max_examples]):
        ground_truth = pdf.ground_truth
        example_output: dict[str, str | list[str]] = {}
        for entity_name, values in ground_truth.items():
            if len(values) == 1:
                example_output[entity_name] = values[0]
            else:
                example_output[entity_name] = values

        full_text = pdf.full_text or ""
        text_excerpt = full_text[:max_chars_per_example] + (
            "..." if len(full_text) > max_chars_per_example else ""
        )
        snapshots.append(
            PromptExampleSnapshot(
                pdf_id=pdf.pdf_id,
                example_order=index,
                text_excerpt=text_excerpt,
                labelled_entities=example_output,
            )
        )

    return snapshots


def format_prompt_example_snapshots(
    examples: list[PromptExampleSnapshot],
) -> str:
    if not examples:
        return ""

    formatted = []
    for example in examples:
        formatted.append(
            f"### Example Document:\n{example.text_excerpt}\n\n"
            f"### Expected Output:\n{json.dumps(example.labelled_entities, indent=2)}"
        )

    return "## Few-Shot Examples\n\n" + "\n\n---\n\n".join(formatted)


def generate_prompt_variants(
    base_prompt: str,
    entity_types: list[EntityTypeInfo],
    project_description: str | None,
) -> list[str]:
    """Generate 3 template-based prompt variants with different guidance styles."""
    variants = [base_prompt]

    precision_guidance = (
        base_prompt
        + "\n\n## Precision Guidance\n"
        "Prefer exact text spans from the document. Do not infer values from nearby context. "
        "Use null or an empty array when the document does not contain a valid value."
    )
    variants.append(precision_guidance)

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


def select_prompt_example_sets(
    labeled_pdfs: list[LabeledPdf],
    *,
    max_examples: int = 2,
) -> list[list[LabeledPdf]]:
    """Return small, deterministic example PDF sets to try in prompt candidates."""
    if not labeled_pdfs or max_examples <= 0:
        return [[]]

    first_set = labeled_pdfs[:max_examples]
    sets = [first_set]

    coverage_set = sorted(
        labeled_pdfs,
        key=lambda pdf: (-len(pdf.ground_truth), str(pdf.pdf_id)),
    )[:max_examples]
    if [pdf.pdf_id for pdf in coverage_set] != [pdf.pdf_id for pdf in first_set]:
        sets.append(coverage_set)

    return sets


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

        for gt_v in gt_normalized:
            if not any(_exact_match(pred_v, gt_v) for pred_v in pred_normalized):
                errors.append(
                    EntityMatch(
                        entity_type_name=et.name,
                        predicted=None,
                        ground_truth=gt_v,
                        is_exact_match=False,
                        is_partial_match=False,
                    )
                )

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


def evaluate_final_pdf_predictions(
    pdf: LabeledPdf,
    predicted: dict,
    entity_types: list[EntityTypeInfo],
) -> FinalPdfEvaluation:
    """Build final-run metric details and persistence rows for one PDF."""
    pairs: list[FinalPredictionPair] = []
    entity_matches: dict[str, bool] = {}
    labelled_counts: dict[str, int] = {}
    matched_counts: dict[str, int] = {}
    false_positive_counts: dict[str, int] = {}
    false_negative_counts: dict[str, int] = {}

    for et in entity_types:
        if et.entity_type_id is None:
            raise ValueError(f"Entity type has no id: {et.name}")

        labelled_values = _normalise_values(pdf.ground_truth.get(et.name, []))
        predicted_values = _normalise_prediction_values(predicted.get(et.name))
        if et.unique and len(labelled_values) > 1:
            raise ValueError(
                f"Unique entity type {et.name!r} has multiple labels for PDF {pdf.pdf_id}"
            )

        if et.unique:
            labelled_value = labelled_values[0] if labelled_values else None
            predicted_value = predicted_values[0] if predicted_values else None
            is_match = (
                len(predicted_values) <= 1
                and (
                    (labelled_value is None and predicted_value is None)
                    or (
                        labelled_value is not None
                        and predicted_value is not None
                        and _exact_match(predicted_value, labelled_value)
                    )
                )
            )
            entity_matches[et.name] = is_match
            labelled_counts[et.name] = len(labelled_values)
            matched_counts[et.name] = 1 if is_match and labelled_value is not None else 0
            false_positive_counts[et.name] = 1 if predicted_value is not None and not is_match else 0
            false_negative_counts[et.name] = 1 if labelled_value is not None and not is_match else 0
            if labelled_value is not None or predicted_value is not None:
                pairs.append(
                    FinalPredictionPair(
                        pdf_id=pdf.pdf_id,
                        entity_type_id=et.entity_type_id,
                        labelled_value=labelled_value,
                        predicted_value=predicted_value,
                    )
                )
            continue

        matched, unmatched_labels, unmatched_predictions = _pair_exact_matches(
            labelled_values,
            predicted_values,
        )
        entity_matches[et.name] = not unmatched_labels and not unmatched_predictions
        labelled_counts[et.name] = len(labelled_values)
        matched_counts[et.name] = len(matched)
        false_positive_counts[et.name] = len(unmatched_predictions)
        false_negative_counts[et.name] = len(unmatched_labels)

        for labelled_value, predicted_value in matched:
            pairs.append(
                FinalPredictionPair(
                    pdf_id=pdf.pdf_id,
                    entity_type_id=et.entity_type_id,
                    labelled_value=labelled_value,
                    predicted_value=predicted_value,
                )
            )
        for labelled_value in unmatched_labels:
            pairs.append(
                FinalPredictionPair(
                    pdf_id=pdf.pdf_id,
                    entity_type_id=et.entity_type_id,
                    labelled_value=labelled_value,
                    predicted_value=None,
                )
            )
        for predicted_value in unmatched_predictions:
            pairs.append(
                FinalPredictionPair(
                    pdf_id=pdf.pdf_id,
                    entity_type_id=et.entity_type_id,
                    labelled_value=None,
                    predicted_value=predicted_value,
                )
            )

    return FinalPdfEvaluation(
        pdf_id=pdf.pdf_id,
        is_fully_correct=all(entity_matches.values()) if entity_types else False,
        pairs=pairs,
        entity_matches=entity_matches,
        labelled_counts=labelled_counts,
        matched_counts=matched_counts,
        false_positive_counts=false_positive_counts,
        false_negative_counts=false_negative_counts,
    )


def build_final_run_metrics(
    final_results: list[FinalPdfEvaluation],
    entity_types: list[EntityTypeInfo],
    *,
    labeled_pdf_count: int,
    skipped_pdf_count: int,
) -> dict:
    evaluated_pdf_count = len(final_results)
    pdfs_fully_correct = sum(1 for result in final_results if result.is_fully_correct)
    entity_type_metrics: dict[str, dict] = {}

    for et in entity_types:
        if et.unique:
            correct_pdf_count = sum(
                1 for result in final_results if result.entity_matches.get(et.name, False)
            )
            entity_type_metrics[et.name] = {
                "unique": True,
                "labeled_pdf_count": evaluated_pdf_count,
                "correct_pdf_count": correct_pdf_count,
                "accuracy": correct_pdf_count / evaluated_pdf_count
                if evaluated_pdf_count
                else None,
            }
            continue

        labelled_entity_count = sum(
            result.labelled_counts.get(et.name, 0) for result in final_results
        )
        true_positive_count = sum(
            result.matched_counts.get(et.name, 0) for result in final_results
        )
        false_positive_count = sum(
            result.false_positive_counts.get(et.name, 0) for result in final_results
        )
        false_negative_count = sum(
            result.false_negative_counts.get(et.name, 0) for result in final_results
        )
        entity_type_metrics[et.name] = {
            "unique": False,
            "labeled_pdf_count": evaluated_pdf_count,
            "labeled_entity_count": labelled_entity_count,
            "true_positive_count": true_positive_count,
            "false_positive_count": false_positive_count,
            "false_negative_count": false_negative_count,
            "tpr": true_positive_count / labelled_entity_count
            if labelled_entity_count
            else None,
            "fppp": false_positive_count / evaluated_pdf_count if evaluated_pdf_count else None,
            "fnr": false_negative_count / labelled_entity_count
            if labelled_entity_count
            else None,
        }

    return {
        "labeled_pdf_count": labeled_pdf_count,
        "evaluated_pdf_count": evaluated_pdf_count,
        "skipped_pdf_count": skipped_pdf_count,
        "pdfs_fully_correct": pdfs_fully_correct,
        "pdf_accuracy": pdfs_fully_correct / evaluated_pdf_count
        if evaluated_pdf_count
        else None,
        "entity_type_metrics": entity_type_metrics,
    }


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
                if err.predicted is None and err.ground_truth is not None:
                    lines.append(f"  - Missed labelled value: {err.ground_truth!r}")
                elif err.ground_truth is not None:
                    lines.append(
                        f"  - Predicted: {err.predicted!r}; labelled: {err.ground_truth!r}"
                    )
                else:
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


def _normalise_value(value: str) -> str:
    return str(value).strip()


def _normalise_values(values: list[str]) -> list[str]:
    return [normalised for value in values if (normalised := _normalise_value(value))]


def _normalise_prediction_values(raw_value) -> list[str]:
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return [normalised for value in raw_value if (normalised := _normalise_value(value))]
    normalised = _normalise_value(raw_value)
    return [normalised] if normalised else []


def _pair_exact_matches(
    labelled_values: list[str],
    predicted_values: list[str],
) -> tuple[list[tuple[str, str]], list[str], list[str]]:
    matched: list[tuple[str, str]] = []
    unmatched_labels = list(labelled_values)
    unmatched_predictions: list[str] = []

    for predicted_value in predicted_values:
        for index, labelled_value in enumerate(unmatched_labels):
            if _exact_match(predicted_value, labelled_value):
                matched.append((labelled_value, predicted_value))
                unmatched_labels.pop(index)
                break
        else:
            unmatched_predictions.append(predicted_value)

    return matched, unmatched_labels, unmatched_predictions

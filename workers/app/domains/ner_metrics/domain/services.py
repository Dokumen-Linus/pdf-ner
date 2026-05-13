from __future__ import annotations

from collections import Counter
from typing import Any
from uuid import UUID

from .entities import LabelValue, MetricsResult
from .value_objects import FScore


def normalise_prediction_values(raw_value: Any) -> list[str]:
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return [normalised for value in raw_value if (normalised := str(value).strip())]
    normalised = str(raw_value).strip()
    return [normalised] if normalised else []


def exact_match(a: str, b: str) -> bool:
    return _normalise_match_value(a) == _normalise_match_value(b)


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


def labels_by_pdf_and_entity(
    labels: list[LabelValue],
) -> dict[UUID, dict[UUID, list[str]]]:
    result: dict[UUID, dict[UUID, list[str]]] = {}
    for label in labels:
        result.setdefault(label.pdf_id, {}).setdefault(label.entity_type_id, []).append(
            label.text_value
        )
    return result


def calculate_metrics(
    *,
    pdf_results: list[Any],
    labels_by_pdf: dict[UUID, dict[UUID, list[str]]],
    entity_types: list[Any],
    beta: float,
    pdf_count: int | None = None,
) -> MetricsResult:
    evaluated_pdf_count = pdf_count if pdf_count is not None else len(pdf_results)
    pdfs_fully_correct = 0
    per_entity_values: dict[str, list[FScore]] = {entity.name: [] for entity in entity_types}
    incorrect_ids: list[UUID] = []
    missed_entity_types: list[dict] = []
    entity_type_metrics: dict[str, dict[str, float]] = {}

    for result in pdf_results:
        pdf_correct = True
        ground_truth = labels_by_pdf.get(result.pdf_id, {})
        persisted_by_entity = _persisted_predictions_by_entity(result.persisted_predictions)

        for entity in entity_types:
            if entity.entity_type_id is None:
                continue
            predicted_values = normalise_prediction_values(result.predictions.get(entity.name))
            labelled_values = ground_truth.get(entity.entity_type_id, [])
            score = calculate_f_score(predicted_values, labelled_values, beta=beta)
            per_entity_values[entity.name].append(score)
            if score.f < 1.0:
                pdf_correct = False

            incorrect_ids.extend(
                _incorrect_prediction_ids(
                    result.persisted_predictions,
                    entity_type_id=entity.entity_type_id,
                    labelled_values=labelled_values,
                )
            )
            if entity.entity_type_id not in persisted_by_entity and labelled_values:
                pdf_correct = False
                missed_entity_types.append(
                    {
                        "entity_type_id": str(entity.entity_type_id),
                        "entity_type": entity.name,
                        "pdf_id": str(result.pdf_id),
                        "labelled_values": labelled_values,
                    }
                )
        if pdf_correct:
            pdfs_fully_correct += 1

    per_entity_scores: dict[str, FScore] = {}
    for entity in entity_types:
        scores = per_entity_values[entity.name]
        if scores:
            precision = sum(score.precision for score in scores) / len(scores)
            recall = sum(score.recall for score in scores) / len(scores)
            f_score = sum(score.f for score in scores) / len(scores)
        else:
            precision = recall = f_score = 0.0
        per_entity_scores[entity.name] = FScore(precision, recall, f_score)
        entity_type_metrics[entity.name] = {
            "precision": precision,
            "recall": recall,
            "f": f_score,
        }

    overall_f = (
        sum(score.f for score in per_entity_scores.values()) / len(per_entity_scores)
        if per_entity_scores
        else 0.0
    )
    return MetricsResult(
        overall_f=overall_f,
        per_entity_scores=per_entity_scores,
        num_correct_pdfs=pdfs_fully_correct,
        accuracy_score=pdfs_fully_correct / evaluated_pdf_count if evaluated_pdf_count else None,
        entity_type_metrics=entity_type_metrics,
        incorrectly_predicted_entity_value_ids=incorrect_ids,
        missed_entity_types=missed_entity_types,
    )


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


def _persisted_predictions_by_entity(persisted_predictions: list[Any]) -> dict[UUID, list[Any]]:
    result: dict[UUID, list[Any]] = {}
    for prediction in persisted_predictions:
        result.setdefault(prediction.entity_type_id, []).append(prediction)
    return result


def _incorrect_prediction_ids(
    persisted_predictions: list[Any],
    *,
    entity_type_id: UUID,
    labelled_values: list[str],
) -> list[UUID]:
    remaining_labels = Counter(_normalise_match_value(value) for value in labelled_values)
    incorrect: list[UUID] = []
    for prediction in persisted_predictions:
        if prediction.entity_type_id != entity_type_id:
            continue
        normalised = _normalise_match_value(prediction.text_value)
        if remaining_labels[normalised] > 0:
            remaining_labels[normalised] -= 1
        else:
            incorrect.append(prediction.entity_value_id)
    return incorrect


def _normalise_match_value(value: str) -> str:
    return value.lower().strip()

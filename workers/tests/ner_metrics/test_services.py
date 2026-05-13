from uuid import uuid4

import pytest

from app.domains.ner_metrics.domain.entities import LabelValue
from app.domains.ner_metrics.domain.services import (
    calculate_f_score,
    calculate_metrics,
    labels_by_pdf_and_entity,
)
from app.domains.ner_runs.domain.entities import EntityTypeInfo, NerPdfResult, PersistedPrediction


def test_calculates_beta_weighted_f_score():
    result = calculate_f_score(["a"], ["a", "b"], beta=2.0)

    assert result.precision == 1.0
    assert result.recall == 0.5
    assert result.f == pytest.approx(0.5555555)


def test_metrics_handle_duplicates_and_incorrect_prediction_ids():
    pdf_id = uuid4()
    entity_type_id = uuid4()
    wrong_prediction_id = 1
    entity = EntityTypeInfo(
        name="name",
        user_definition=None,
        user_examples=[],
        user_format_description=None,
        datatype=None,
        single_word=False,
        exact_length=None,
        unique=False,
        required=True,
        entity_type_id=entity_type_id,
    )
    labels = labels_by_pdf_and_entity(
        [
            LabelValue(pdf_id, entity_type_id, "name", "Acme"),
            LabelValue(pdf_id, entity_type_id, "name", "Acme"),
        ]
    )
    result = NerPdfResult(
        pdf_id=pdf_id,
        predictions={"name": ["acme", "wrong"]},
        persisted_predictions=[
            PersistedPrediction(2, pdf_id, entity_type_id, "acme"),
            PersistedPrediction(wrong_prediction_id, pdf_id, entity_type_id, "wrong"),
        ],
    )

    metrics = calculate_metrics(
        pdf_results=[result],
        labels_by_pdf=labels,
        entity_types=[entity],
        beta=1.0,
        pdf_count=1,
    )

    assert metrics.overall_f == pytest.approx(0.5)
    assert metrics.accuracy_score == 0.0
    assert metrics.incorrectly_predicted_entity_value_ids == [wrong_prediction_id]


def test_metrics_report_missed_entity_types():
    pdf_id = uuid4()
    entity_type_id = uuid4()
    entity = EntityTypeInfo(
        name="invoice_id",
        user_definition=None,
        user_examples=[],
        user_format_description=None,
        datatype=None,
        single_word=False,
        exact_length=None,
        unique=True,
        required=True,
        entity_type_id=entity_type_id,
    )
    labels = labels_by_pdf_and_entity([LabelValue(pdf_id, entity_type_id, "invoice_id", "INV-1")])

    metrics = calculate_metrics(
        pdf_results=[NerPdfResult(pdf_id=pdf_id, predictions={}, persisted_predictions=[])],
        labels_by_pdf=labels,
        entity_types=[entity],
        beta=1.0,
        pdf_count=1,
    )

    assert metrics.overall_f == 0.0
    assert metrics.accuracy_score == 0.0
    assert metrics.missed_entity_types == [
        {
            "entity_type_id": str(entity_type_id),
            "entity_type": "invoice_id",
            "pdf_id": str(pdf_id),
            "labelled_values": ["INV-1"],
        }
    ]

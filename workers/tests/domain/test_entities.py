"""Tests for domain entities: EntityTypeInfo, LabeledPdf, PromptCandidate, EvaluationResult."""

from uuid import uuid4

from app.domains.context_engineering.domain.entities import (
    EntityTypeInfo,
    LabeledAnnotation,
    LabeledPdf,
    PromptCandidate,
)
from app.domains.context_engineering.domain.value_objects import F1Score


class TestEntityTypeInfo:
    def test_best_definition_prefers_user(self, name_entity_type):
        assert name_entity_type.best_definition == "The person's full legal name"

    def test_best_definition_falls_back_to_std(self, ssn_entity_type):
        assert ssn_entity_type.best_definition == "Social Security Number"

    def test_best_definition_empty_when_none(self):
        et = EntityTypeInfo(
            name="test",
            user_definition=None,
            user_examples=[],
            user_format_description=None,
            datatype=None,
            single_word=False,
            exact_length=None,
            unique=True,
            required=True,
        )
        assert et.best_definition == ""

    def test_all_examples_merges_and_dedupes(self, name_entity_type):
        examples = name_entity_type.all_examples
        assert examples == ["John Smith", "Jane Doe", "Alice Johnson"]

    def test_all_examples_user_only(self, phone_entity_type):
        assert phone_entity_type.all_examples == ["555-1234"]

    def test_all_examples_std_only(self):
        et = EntityTypeInfo(
            name="test",
            user_definition=None,
            user_examples=[],
            user_format_description=None,
            datatype=None,
            single_word=False,
            exact_length=None,
            unique=True,
            required=True,
            std_examples=["example1", "example2"],
        )
        assert et.all_examples == ["example1", "example2"]

    def test_all_examples_deduplicates(self):
        et = EntityTypeInfo(
            name="test",
            user_definition=None,
            user_examples=["dup", "unique1"],
            user_format_description=None,
            datatype=None,
            single_word=False,
            exact_length=None,
            unique=True,
            required=True,
            std_examples=["dup", "unique2"],
        )
        assert et.all_examples == ["dup", "unique1", "unique2"]

    def test_all_examples_preserves_order(self):
        et = EntityTypeInfo(
            name="test",
            user_definition=None,
            user_examples=["c", "a"],
            user_format_description=None,
            datatype=None,
            single_word=False,
            exact_length=None,
            unique=True,
            required=True,
            std_examples=["b", "d"],
        )
        assert et.all_examples == ["c", "a", "b", "d"]


class TestLabeledPdf:
    def test_ground_truth_groups_by_entity(self, labeled_pdf_1):
        gt = labeled_pdf_1.ground_truth
        assert gt["full_name"] == ["John Smith"]
        assert gt["ssn"] == ["123-45-6789"]
        assert gt["phone_numbers"] == ["555-1234", "555-5678"]

    def test_ground_truth_empty_annotations(self):
        pdf = LabeledPdf(
            pdf_id=uuid4(),
            full_text="some text",
            text_by_page=None,
            annotations=[],
        )
        assert pdf.ground_truth == {}

    def test_ground_truth_single_entity_type(self):
        pdf_id = uuid4()
        pdf = LabeledPdf(
            pdf_id=pdf_id,
            full_text="text",
            text_by_page=None,
            annotations=[
                LabeledAnnotation(
                    pdf_id=pdf_id, entity_type_name="name", labeled_text="A", page_index=0
                ),
                LabeledAnnotation(
                    pdf_id=pdf_id, entity_type_name="name", labeled_text="B", page_index=1
                ),
            ],
        )
        assert pdf.ground_truth == {"name": ["A", "B"]}


class TestPromptCandidate:
    def test_defaults(self):
        pc = PromptCandidate(system_prompt="test", iteration=0)
        assert pc.scores is None
        assert pc.overall_f1 is None
        assert pc.error_analysis is None

    def test_with_scores(self):
        score = F1Score(precision=0.9, recall=0.8, f1=0.85)
        pc = PromptCandidate(
            system_prompt="test",
            iteration=3,
            scores={"name": score},
            overall_f1=0.85,
        )
        assert pc.scores["name"] == score
        assert pc.overall_f1 == 0.85

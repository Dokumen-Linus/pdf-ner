import json

import pytest

from app.domains.context_engineering.domain.entities import (
    EntityTypeInfo,
    EvaluationResult,
    LabeledAnnotation,
    LabeledPdf,
    PromptCandidate,
)
from app.domains.context_engineering.domain.services import (
    _build_constraint_text,
    _count_matches,
    _datatype_to_json_type,
    _exact_match,
    _partial_match,
    build_base_system_prompt,
    build_error_analysis,
    build_final_run_metrics,
    build_json_schema,
    build_prompt_example_snapshots,
    build_refinement_prompt,
    evaluate_final_pdf_predictions,
    evaluate_predictions,
    format_few_shot_examples,
    generate_prompt_variants,
    render_prompt_template,
    select_prompt_example_sets,
)
from app.domains.context_engineering.domain.value_objects import EntityMatch, F1Score

# ─── JSON Schema Builder ─────────────────────────────────────────────────


class TestBuildJsonSchema:
    def test_basic_schema_structure(self, entity_types):
        schema = build_json_schema(entity_types)
        assert schema["type"] == "object"
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == {"full_name", "ssn", "phone_numbers"}

    def test_unique_required_field_type(self, name_entity_type):
        schema = build_json_schema([name_entity_type])
        prop = schema["properties"]["full_name"]
        assert prop["type"] == "string"
        assert "null" not in str(prop["type"])

    def test_unique_optional_field_nullable(self, ssn_entity_type):
        schema = build_json_schema([ssn_entity_type])
        prop = schema["properties"]["ssn"]
        assert prop["type"] == ["string", "null"]

    def test_non_unique_field_is_array(self, phone_entity_type):
        schema = build_json_schema([phone_entity_type])
        prop = schema["properties"]["phone_numbers"]
        assert prop["type"] == "array"
        assert prop["items"]["type"] == "string"

    def test_float_datatype_maps_to_number(self, amount_entity_type):
        schema = build_json_schema([amount_entity_type])
        prop = schema["properties"]["amount"]
        assert prop["type"] == "number"

    def test_int_datatype_maps_to_integer(self, count_entity_type):
        schema = build_json_schema([count_entity_type])
        prop = schema["properties"]["item_count"]
        assert prop["type"] == "integer"

    def test_description_from_best_definition(self, name_entity_type):
        schema = build_json_schema([name_entity_type])
        prop = schema["properties"]["full_name"]
        assert "description" in prop
        assert prop["description"] == name_entity_type.best_definition

    def test_no_description_when_empty(self):
        et = EntityTypeInfo(
            name="bare",
            user_definition=None,
            user_examples=[],
            user_format_description=None,
            datatype=None,
            single_word=False,
            exact_length=None,
            unique=True,
            required=True,
        )
        schema = build_json_schema([et])
        assert "description" not in schema["properties"]["bare"]

    def test_empty_entity_types(self):
        schema = build_json_schema([])
        assert schema["properties"] == {}
        assert schema["required"] == []

    def test_all_entities_in_required(self, entity_types):
        schema = build_json_schema(entity_types)
        assert len(schema["required"]) == len(entity_types)


class TestDatatypeToJsonType:
    @pytest.mark.parametrize(
        "datatype, expected",
        [
            ("int", "integer"),
            ("float", "number"),
            ("alphanumeric", "string"),
            ("alpha", "string"),
            (None, "string"),
            ("unknown", "string"),
        ],
    )
    def test_mapping(self, datatype, expected):
        assert _datatype_to_json_type(datatype) == expected


# ─── Prompt Engineering ───────────────────────────────────────────────────


class TestBuildBaseSystemPrompt:
    def test_includes_ner_instruction(self, entity_types):
        prompt = build_base_system_prompt("Invoice", entity_types)
        assert "named entity recognition" in prompt.lower()

    def test_includes_project_description(self, entity_types):
        prompt = build_base_system_prompt("Invoice document", entity_types)
        assert "Invoice document" in prompt

    def test_no_project_description(self, entity_types):
        prompt = build_base_system_prompt(None, entity_types)
        assert "Document Type" not in prompt

    def test_includes_entity_names(self, entity_types):
        prompt = build_base_system_prompt("test", entity_types)
        for et in entity_types:
            assert f"### {et.name}" in prompt

    def test_includes_definitions(self, name_entity_type):
        prompt = build_base_system_prompt("test", [name_entity_type])
        assert name_entity_type.best_definition in prompt

    def test_includes_examples(self, name_entity_type):
        prompt = build_base_system_prompt("test", [name_entity_type])
        assert "John Smith" in prompt

    def test_includes_format(self, name_entity_type):
        prompt = build_base_system_prompt("test", [name_entity_type])
        assert "First Last" in prompt

    def test_includes_constraints(self, ssn_entity_type):
        prompt = build_base_system_prompt("test", [ssn_entity_type])
        assert "single word only" in prompt
        assert "exactly 11 characters" in prompt
        assert r"\d{3}-\d{2}-\d{4}" in prompt

    def test_unique_cardinality(self, name_entity_type):
        prompt = build_base_system_prompt("test", [name_entity_type])
        assert "exactly one value" in prompt

    def test_array_cardinality(self, phone_entity_type):
        prompt = build_base_system_prompt("test", [phone_entity_type])
        assert "multiple times" in prompt

    def test_required_label(self, name_entity_type):
        prompt = build_base_system_prompt("test", [name_entity_type])
        assert "REQUIRED" in prompt

    def test_optional_label(self, ssn_entity_type):
        prompt = build_base_system_prompt("test", [ssn_entity_type])
        assert "OPTIONAL" in prompt

    def test_output_format_section(self, entity_types):
        prompt = build_base_system_prompt("test", entity_types)
        assert "JSON object" in prompt


class TestBuildConstraintText:
    def test_all_constraints(self, ssn_entity_type):
        text = _build_constraint_text(ssn_entity_type)
        assert "alphanumeric" in text
        assert "single word" in text
        assert "exactly 11 characters" in text
        assert r"\d{3}-\d{2}-\d{4}" in text

    def test_no_constraints(self):
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
        assert _build_constraint_text(et) == ""


class TestFormatFewShotExamples:
    def test_formats_labeled_pdfs(self, labeled_pdf_1):
        result = format_few_shot_examples([labeled_pdf_1])
        assert "Few-Shot Examples" in result
        assert "Example Document" in result
        assert "Expected Output" in result
        assert "John Smith" in result

    def test_empty_list(self):
        assert format_few_shot_examples([]) == ""

    def test_max_examples_limit(self, labeled_pdfs):
        result = format_few_shot_examples(labeled_pdfs, max_examples=1)
        assert result.count("Example Document") == 1

    def test_truncates_long_text(self):
        pdf = LabeledPdf(
            pdf_id=LabeledPdf.__dataclass_fields__["pdf_id"].default
            if hasattr(LabeledPdf.__dataclass_fields__["pdf_id"], "default")
            else __import__("uuid").uuid4(),
            full_text="x" * 3000,
            text_by_page=None,
            annotations=[
                LabeledAnnotation(
                    pdf_id=__import__("uuid").uuid4(),
                    entity_type_name="name",
                    labeled_text="test",
                    page_index=0,
                ),
            ],
        )
        result = format_few_shot_examples([pdf])
        assert "..." in result

    def test_single_value_not_wrapped_in_list(self, labeled_pdf_3):
        result = format_few_shot_examples([labeled_pdf_3])
        parsed_section = result.split("Expected Output:\n")[1]
        output = json.loads(parsed_section)
        assert isinstance(output["full_name"], str)

    def test_multi_value_as_list(self, labeled_pdf_1):
        result = format_few_shot_examples([labeled_pdf_1])
        parsed_section = result.split("Expected Output:\n")[1]
        output = json.loads(parsed_section)
        assert isinstance(output["phone_numbers"], list)

    def test_builds_example_snapshot_for_persistence(self, labeled_pdf_1):
        snapshots = build_prompt_example_snapshots([labeled_pdf_1], max_examples=1)

        assert len(snapshots) == 1
        assert snapshots[0].pdf_id == labeled_pdf_1.pdf_id
        assert snapshots[0].example_order == 0
        assert "John Smith" in snapshots[0].text_excerpt
        assert snapshots[0].labelled_entities["full_name"] == "John Smith"


class TestRenderPromptTemplate:
    def test_replaces_supported_placeholders(self, entity_types):
        template = (
            "<PROJECT_DESCRIPTION>|<ENTITY_TYPES>|<DEFINITIONS>|<EXAMPLE_VALUES>|"
            "<IS_REQUIRED>|<IS_UNIQUE>"
        )

        result = render_prompt_template(template, "Invoices", entity_types)

        assert "<PROJECT_DESCRIPTION>" not in result
        assert "Invoices" in result
        assert "full_name" in result
        assert "The person's full legal name" in result
        assert "John Smith" in result
        assert "True" in result


class TestGeneratePromptVariants:
    def test_returns_three_variants(self, entity_types):
        base = "Base prompt text"
        variants = generate_prompt_variants(base, entity_types, "Invoice")
        assert len(variants) == 3

    def test_variant_0_is_base(self, entity_types):
        base = "Base prompt text"
        variants = generate_prompt_variants(base, entity_types, "Invoice")
        assert variants[0] == base

    def test_variant_1_is_concise(self, entity_types):
        base = "Base prompt text"
        variants = generate_prompt_variants(base, entity_types, "Invoice")
        assert "Precision Guidance" in variants[1]
        assert base in variants[1]

    def test_variant_1_without_description(self, entity_types):
        variants = generate_prompt_variants("base", entity_types, None)
        assert "Document type:" not in variants[1]

    def test_variant_2_is_chain_of_thought(self, entity_types):
        base = "Base prompt text"
        variants = generate_prompt_variants(base, entity_types, "Invoice")
        assert "Extraction Strategy" in variants[2]
        assert base in variants[2]

    def test_entity_names_in_concise(self, entity_types):
        variants = generate_prompt_variants("base", entity_types, None)
        assert "base" in variants[1]

    def test_selects_first_and_coverage_example_sets(
        self, labeled_pdf_1, labeled_pdf_2, labeled_pdf_3
    ):
        sets = select_prompt_example_sets([labeled_pdf_3, labeled_pdf_1, labeled_pdf_2])

        assert [pdf.pdf_id for pdf in sets[0]] == [labeled_pdf_3.pdf_id, labeled_pdf_1.pdf_id]
        assert [pdf.pdf_id for pdf in sets[1]] == [labeled_pdf_1.pdf_id, labeled_pdf_2.pdf_id]


class TestBuildRefinementPrompt:
    def test_includes_current_prompt(self, entity_types):
        result = build_refinement_prompt("my prompt", "some errors", entity_types)
        assert "my prompt" in result

    def test_includes_error_analysis(self, entity_types):
        result = build_refinement_prompt("prompt", "### name (3 errors)", entity_types)
        assert "### name (3 errors)" in result

    def test_includes_entity_names(self, entity_types):
        result = build_refinement_prompt("prompt", "errors", entity_types)
        for et in entity_types:
            assert et.name in result

    def test_asks_for_improved_prompt(self, entity_types):
        result = build_refinement_prompt("prompt", "errors", entity_types)
        assert "improved" in result.lower()


# ─── Evaluation ───────────────────────────────────────────────────────────


class TestExactMatch:
    def test_same_string(self):
        assert _exact_match("hello", "hello") is True

    def test_case_insensitive(self):
        assert _exact_match("Hello", "hello") is True

    def test_strips_whitespace(self):
        assert _exact_match(" hello ", "hello") is True

    def test_different_strings(self):
        assert _exact_match("hello", "world") is False


class TestPartialMatch:
    def test_substring(self):
        assert _partial_match("John", "John Smith") is True

    def test_reverse_substring(self):
        assert _partial_match("John Smith", "John") is True

    def test_exact_is_partial(self):
        assert _partial_match("hello", "hello") is True

    def test_case_insensitive(self):
        assert _partial_match("john", "John Smith") is True

    def test_no_match(self):
        assert _partial_match("Alice", "Bob") is False


class TestCountMatches:
    def test_all_exact(self):
        exact, partial = _count_matches(["a", "b"], ["a", "b"])
        assert exact == 2
        assert partial == 2

    def test_no_matches(self):
        exact, partial = _count_matches(["x", "y"], ["a", "b"])
        assert exact == 0
        assert partial == 0

    def test_partial_only(self):
        exact, partial = _count_matches(["John"], ["John Smith"])
        assert exact == 0
        assert partial == 1

    def test_deduplication(self):
        exact, partial = _count_matches(["a", "a"], ["a"])
        assert exact == 1
        assert partial == 1

    def test_empty_predicted(self):
        exact, partial = _count_matches([], ["a", "b"])
        assert exact == 0
        assert partial == 0

    def test_empty_ground_truth(self):
        exact, partial = _count_matches(["a"], [])
        assert exact == 0
        assert partial == 0

    def test_prefers_exact_over_partial(self):
        exact, partial = _count_matches(["abc"], ["abc", "abcdef"])
        assert exact == 1
        assert partial == 1


class TestEvaluatePredictions:
    def test_perfect_predictions(self, entity_types, labeled_pdf_1):
        predicted = {
            "full_name": "John Smith",
            "ssn": "123-45-6789",
            "phone_numbers": ["555-1234", "555-5678"],
        }
        result = evaluate_predictions(predicted, labeled_pdf_1.ground_truth, entity_types)
        assert result.per_entity_scores["full_name"].f1 == 1.0
        assert result.per_entity_scores["ssn"].f1 == 1.0
        assert result.per_entity_scores["phone_numbers"].f1 == 1.0
        assert result.overall_f1 == 1.0

    def test_no_predictions(self, entity_types, labeled_pdf_1):
        result = evaluate_predictions({}, labeled_pdf_1.ground_truth, entity_types)
        assert result.per_entity_scores["full_name"].precision == 0.0
        assert result.per_entity_scores["full_name"].recall == 0.0
        assert result.overall_f1 == pytest.approx(0.0, abs=0.01)

    def test_null_prediction_treated_as_empty(self, name_entity_type):
        gt = {"full_name": ["John"]}
        predicted = {"full_name": None}
        result = evaluate_predictions(predicted, gt, [name_entity_type])
        assert result.per_entity_scores["full_name"].recall == 0.0

    def test_list_prediction_filters_none(self, phone_entity_type):
        gt = {"phone_numbers": ["555-1234"]}
        predicted = {"phone_numbers": [None, "555-1234", None]}
        result = evaluate_predictions(predicted, gt, [phone_entity_type])
        assert result.per_entity_scores["phone_numbers"].recall == 1.0

    def test_scalar_prediction_wrapped_to_list(self, name_entity_type):
        gt = {"full_name": ["John Smith"]}
        predicted = {"full_name": "John Smith"}
        result = evaluate_predictions(predicted, gt, [name_entity_type])
        assert result.per_entity_scores["full_name"].f1 == 1.0

    def test_missing_entity_in_ground_truth(self, name_entity_type):
        gt = {}
        predicted = {"full_name": "John"}
        result = evaluate_predictions(predicted, gt, [name_entity_type])
        assert result.per_entity_scores["full_name"].precision == 0.0

    def test_missing_entity_in_both(self, name_entity_type):
        gt = {}
        predicted = {}
        result = evaluate_predictions(predicted, gt, [name_entity_type])
        # Both empty: precision=1.0 (nothing wrong predicted), recall=1.0 (nothing missed)
        assert result.per_entity_scores["full_name"].precision == 1.0
        assert result.per_entity_scores["full_name"].recall == 1.0

    def test_errors_populated_on_mismatch(self, name_entity_type):
        gt = {"full_name": ["John Smith"]}
        predicted = {"full_name": "Jane Doe"}
        result = evaluate_predictions(predicted, gt, [name_entity_type])
        assert len(result.errors) > 0
        assert result.errors[0].entity_type_name == "full_name"
        assert result.errors[0].predicted == "Jane Doe"

    def test_overall_exact_and_partial_rates(self, entity_types, labeled_pdf_1):
        predicted = {
            "full_name": "John Smith",
            "ssn": "123-45-6789",
            "phone_numbers": ["555-1234", "555-5678"],
        }
        result = evaluate_predictions(predicted, labeled_pdf_1.ground_truth, entity_types)
        assert result.overall_exact_match_rate == 1.0
        assert result.overall_partial_match_rate == 1.0

    def test_empty_entity_types_gives_zero(self, labeled_pdf_1):
        result = evaluate_predictions({}, labeled_pdf_1.ground_truth, [])
        assert result.overall_f1 == 0.0


class TestFinalRunMetrics:
    def test_unique_mismatch_uses_single_pair_row(self, name_entity_type, labeled_pdf_1):
        result = evaluate_final_pdf_predictions(
            labeled_pdf_1,
            {"full_name": "Jane Doe"},
            [name_entity_type],
        )

        assert result.is_fully_correct is False
        assert len(result.pairs) == 1
        assert result.pairs[0].labelled_value == "John Smith"
        assert result.pairs[0].predicted_value == "Jane Doe"

    def test_non_unique_unmatched_values_are_split(self, phone_entity_type, labeled_pdf_1):
        result = evaluate_final_pdf_predictions(
            labeled_pdf_1,
            {"phone_numbers": ["555-1234", "555-9999"]},
            [phone_entity_type],
        )

        assert result.matched_counts["phone_numbers"] == 1
        assert result.false_positive_counts["phone_numbers"] == 1
        assert result.false_negative_counts["phone_numbers"] == 1
        assert any(pair.labelled_value is None for pair in result.pairs)
        assert any(pair.predicted_value is None for pair in result.pairs)

    def test_builds_unique_and_non_unique_metrics(self, entity_types, labeled_pdf_1):
        final_result = evaluate_final_pdf_predictions(
            labeled_pdf_1,
            {
                "full_name": "John Smith",
                "ssn": "wrong",
                "phone_numbers": ["555-1234", "555-9999"],
            },
            entity_types,
        )

        metrics = build_final_run_metrics(
            [final_result],
            entity_types,
            labeled_pdf_count=2,
            skipped_pdf_count=1,
        )

        assert metrics["evaluated_pdf_count"] == 1
        assert metrics["skipped_pdf_count"] == 1
        assert metrics["pdf_accuracy"] == 0.0
        assert metrics["entity_type_metrics"]["full_name"]["accuracy"] == 1.0
        assert metrics["entity_type_metrics"]["phone_numbers"]["tpr"] == 0.5
        assert metrics["entity_type_metrics"]["phone_numbers"]["fppp"] == 1.0
        assert metrics["entity_type_metrics"]["phone_numbers"]["fnr"] == 0.5


class TestBuildErrorAnalysis:
    def test_no_errors_empty_string(self, entity_types):
        result = EvaluationResult(
            prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
            per_entity_scores={"full_name": F1Score(1.0, 1.0, 1.0)},
            overall_exact_match_rate=1.0,
            overall_partial_match_rate=1.0,
            overall_f1=1.0,
            errors=[],
        )
        analysis = build_error_analysis([result], entity_types)
        assert analysis == ""

    def test_includes_error_count(self, entity_types):
        errors = [
            EntityMatch(
                entity_type_name="full_name",
                predicted="Wrong Name",
                ground_truth=None,
                is_exact_match=False,
                is_partial_match=False,
            ),
        ]
        result = EvaluationResult(
            prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
            per_entity_scores={"full_name": F1Score(0.0, 0.0, 0.0)},
            overall_exact_match_rate=0.0,
            overall_partial_match_rate=0.0,
            overall_f1=0.0,
            errors=errors,
        )
        analysis = build_error_analysis([result], entity_types)
        assert "full_name (1 errors)" in analysis
        assert "'Wrong Name'" in analysis

    def test_limits_to_five_samples(self, name_entity_type):
        errors = [
            EntityMatch(
                entity_type_name="full_name",
                predicted=f"Name{i}",
                ground_truth=None,
                is_exact_match=False,
                is_partial_match=False,
            )
            for i in range(10)
        ]
        result = EvaluationResult(
            prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
            per_entity_scores={"full_name": F1Score(0.0, 0.0, 0.0)},
            overall_exact_match_rate=0.0,
            overall_partial_match_rate=0.0,
            overall_f1=0.0,
            errors=errors,
        )
        analysis = build_error_analysis([result], [name_entity_type])
        assert analysis.count("Predicted:") == 5

    def test_includes_average_f1(self, name_entity_type):
        result = EvaluationResult(
            prompt_candidate=PromptCandidate(system_prompt="", iteration=0),
            per_entity_scores={"full_name": F1Score(0.5, 0.5, 0.5)},
            overall_exact_match_rate=0.5,
            overall_partial_match_rate=0.5,
            overall_f1=0.5,
            errors=[
                EntityMatch(
                    entity_type_name="full_name",
                    predicted="wrong",
                    ground_truth=None,
                    is_exact_match=False,
                    is_partial_match=False,
                ),
            ],
        )
        analysis = build_error_analysis([result], [name_entity_type])
        assert "Average F1: 0.500" in analysis

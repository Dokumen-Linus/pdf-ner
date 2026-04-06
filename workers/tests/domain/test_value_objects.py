"""Tests for domain value objects: F1Score and EntityMatch."""

import pytest

from app.domains.context_engineering.domain.value_objects import EntityMatch, F1Score


class TestF1Score:
    def test_valid_score(self):
        score = F1Score(precision=0.8, recall=0.9, f1=0.85)
        assert score.precision == 0.8
        assert score.recall == 0.9
        assert score.f1 == 0.85

    def test_perfect_score(self):
        score = F1Score(precision=1.0, recall=1.0, f1=1.0)
        assert score.precision == 1.0

    def test_zero_score(self):
        score = F1Score(precision=0.0, recall=0.0, f1=0.0)
        assert score.f1 == 0.0

    def test_boundary_values(self):
        F1Score(precision=0.0, recall=1.0, f1=0.5)
        F1Score(precision=1.0, recall=0.0, f1=0.0)

    def test_precision_below_zero_raises(self):
        with pytest.raises(ValueError, match="precision"):
            F1Score(precision=-0.1, recall=0.5, f1=0.3)

    def test_precision_above_one_raises(self):
        with pytest.raises(ValueError, match="precision"):
            F1Score(precision=1.1, recall=0.5, f1=0.3)

    def test_recall_below_zero_raises(self):
        with pytest.raises(ValueError, match="recall"):
            F1Score(precision=0.5, recall=-0.01, f1=0.3)

    def test_recall_above_one_raises(self):
        with pytest.raises(ValueError, match="recall"):
            F1Score(precision=0.5, recall=1.5, f1=0.3)

    def test_f1_below_zero_raises(self):
        with pytest.raises(ValueError, match="f1"):
            F1Score(precision=0.5, recall=0.5, f1=-0.1)

    def test_f1_above_one_raises(self):
        with pytest.raises(ValueError, match="f1"):
            F1Score(precision=0.5, recall=0.5, f1=1.001)

    def test_is_frozen(self):
        score = F1Score(precision=0.5, recall=0.5, f1=0.5)
        with pytest.raises(AttributeError):
            score.precision = 0.9  # type: ignore[misc]

    def test_equality(self):
        s1 = F1Score(precision=0.8, recall=0.9, f1=0.85)
        s2 = F1Score(precision=0.8, recall=0.9, f1=0.85)
        assert s1 == s2

    def test_inequality(self):
        s1 = F1Score(precision=0.8, recall=0.9, f1=0.85)
        s2 = F1Score(precision=0.7, recall=0.9, f1=0.85)
        assert s1 != s2


class TestEntityMatch:
    def test_exact_match(self):
        m = EntityMatch(
            entity_type_name="name",
            predicted="John",
            ground_truth="John",
            is_exact_match=True,
            is_partial_match=True,
        )
        assert m.is_exact_match is True
        assert m.is_partial_match is True

    def test_partial_match(self):
        m = EntityMatch(
            entity_type_name="name",
            predicted="John Smith",
            ground_truth="John Smith Jr",
            is_exact_match=False,
            is_partial_match=True,
        )
        assert m.is_exact_match is False
        assert m.is_partial_match is True

    def test_no_match(self):
        m = EntityMatch(
            entity_type_name="name",
            predicted="Alice",
            ground_truth="Bob",
            is_exact_match=False,
            is_partial_match=False,
        )
        assert m.is_exact_match is False
        assert m.is_partial_match is False

    def test_none_ground_truth(self):
        m = EntityMatch(
            entity_type_name="ssn",
            predicted="123-45-6789",
            ground_truth=None,
            is_exact_match=False,
            is_partial_match=False,
        )
        assert m.ground_truth is None

    def test_is_frozen(self):
        m = EntityMatch(
            entity_type_name="name",
            predicted="John",
            ground_truth="John",
            is_exact_match=True,
            is_partial_match=True,
        )
        with pytest.raises(AttributeError):
            m.predicted = "Jane"  # type: ignore[misc]

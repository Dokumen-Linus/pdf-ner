from uuid import uuid4

from app.domains.context_engineering.domain.events import (
    EvaluationRoundCompleted,
    PromptOptimizationCompleted,
)
from app.shared.domain.DomainEvent import DomainEvent


class TestDomainEvent:
    def test_new_generates_fields(self):
        fields = DomainEvent.new()
        assert "event_id" in fields
        assert "occurred_at" in fields
        assert fields["occurred_at"].tzinfo is not None

    def test_new_unique_ids(self):
        f1 = DomainEvent.new()
        f2 = DomainEvent.new()
        assert f1["event_id"] != f2["event_id"]


class TestPromptOptimizationCompleted:
    def test_create(self):
        project_id = uuid4()
        prompt_id = uuid4()
        event = PromptOptimizationCompleted(
            **DomainEvent.new(),
            project_id=project_id,
            best_prompt_id=prompt_id,
            best_f1=0.92,
            iterations_run=3,
        )
        assert event.project_id == project_id
        assert event.best_prompt_id == prompt_id
        assert event.best_f1 == 0.92
        assert event.iterations_run == 3

    def test_is_frozen(self):
        import pytest

        event = PromptOptimizationCompleted(
            **DomainEvent.new(),
            project_id=uuid4(),
            best_prompt_id=uuid4(),
            best_f1=0.5,
            iterations_run=1,
        )
        with pytest.raises(AttributeError):
            event.best_f1 = 0.99  # type: ignore[misc]


class TestEvaluationRoundCompleted:
    def test_create(self):
        project_id = uuid4()
        event = EvaluationRoundCompleted(
            **DomainEvent.new(),
            project_id=project_id,
            iteration=2,
            overall_f1=0.88,
        )
        assert event.project_id == project_id
        assert event.iteration == 2
        assert event.overall_f1 == 0.88

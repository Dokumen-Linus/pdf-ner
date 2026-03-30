"""Tests for application commands."""

import pytest

from app.domains.context_engineering.application.commands import OptimizePrompt
from tests.conftest import PROJECT_ID


class TestOptimizePrompt:
    def test_defaults(self):
        cmd = OptimizePrompt(project_id=PROJECT_ID)
        assert cmd.max_iterations == 5
        assert cmd.convergence_threshold == 0.02
        assert cmd.model == "gpt-4o"
        assert cmd.refinement_model == "gpt-4o"

    def test_custom_values(self):
        cmd = OptimizePrompt(
            project_id=PROJECT_ID,
            max_iterations=10,
            convergence_threshold=0.05,
            model="gpt-4o-mini",
            refinement_model="gpt-4o-mini",
        )
        assert cmd.max_iterations == 10
        assert cmd.model == "gpt-4o-mini"

    def test_is_frozen(self):
        cmd = OptimizePrompt(project_id=PROJECT_ID)
        with pytest.raises(AttributeError):
            cmd.max_iterations = 10  # type: ignore[misc]

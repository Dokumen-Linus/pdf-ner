from decimal import Decimal

import pytest

from app.domains.context_engineering.application.commands import OptimizePrompt
from tests.conftest import PROJECT_ID


class TestOptimizePrompt:
    def test_defaults(self):
        cmd = OptimizePrompt(project_id=PROJECT_ID)
        assert cmd.max_cost_usd == Decimal("1.00")
        assert cmd.convergence_threshold == 0.02
        assert cmd.model == "gpt-4o"
        assert cmd.refinement_model == "gpt-4o"

    def test_custom_values(self):
        cmd = OptimizePrompt(
            project_id=PROJECT_ID,
            max_cost_usd=Decimal("2.50"),
            convergence_threshold=0.05,
            model="gpt-4o-mini",
            refinement_model="gpt-4o-mini",
        )
        assert cmd.max_cost_usd == Decimal("2.50")
        assert cmd.model == "gpt-4o-mini"

    def test_is_frozen(self):
        cmd = OptimizePrompt(project_id=PROJECT_ID)
        with pytest.raises(AttributeError):
            cmd.max_cost_usd = Decimal("10")  # type: ignore[misc]

    def test_rejects_non_positive_cost(self):
        with pytest.raises(ValueError, match="max_cost_usd"):
            OptimizePrompt(project_id=PROJECT_ID, max_cost_usd=Decimal("0"))

from decimal import Decimal

import pytest

from app.domains.context_engineering.application.commands import OptimizePrompt
from tests.conftest import PDF_ID_1, PROJECT_ID


class TestOptimizePrompt:
    def test_defaults(self):
        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=1, labeled_pdfs=[PDF_ID_1])
        assert cmd.template_id == 1
        assert cmd.max_cost_usd == Decimal("1.00")
        assert cmd.convergence_threshold == 0.02
        assert cmd.beta == 1.0
        assert cmd.ner_chat_model == "gpt-5.4-mini"
        assert cmd.prompt_eng_chat_model == "gpt-5.4-mini"

    def test_custom_values(self):
        cmd = OptimizePrompt(
            project_id=PROJECT_ID,
            template_id=2,
            labeled_pdfs=[PDF_ID_1],
            beta=2.0,
            max_cost_usd=Decimal("2.50"),
            convergence_threshold=0.05,
            ner_chat_model="gpt-4o-mini",
            prompt_eng_chat_model="gpt-4o",
        )
        assert cmd.max_cost_usd == Decimal("2.50")
        assert cmd.beta == 2.0
        assert cmd.ner_chat_model == "gpt-4o-mini"

    def test_is_frozen(self):
        cmd = OptimizePrompt(project_id=PROJECT_ID, template_id=1, labeled_pdfs=[PDF_ID_1])
        with pytest.raises(AttributeError):
            cmd.max_cost_usd = Decimal("10")  # type: ignore[misc]

    def test_rejects_non_positive_cost(self):
        with pytest.raises(ValueError, match="max_cost_usd"):
            OptimizePrompt(
                project_id=PROJECT_ID,
                template_id=1,
                labeled_pdfs=[PDF_ID_1],
                max_cost_usd=Decimal("0"),
            )

    def test_rejects_non_positive_template_id(self):
        with pytest.raises(ValueError, match="template_id"):
            OptimizePrompt(project_id=PROJECT_ID, template_id=0, labeled_pdfs=[PDF_ID_1])

    def test_rejects_empty_labeled_pdfs(self):
        with pytest.raises(ValueError, match="labeled_pdfs"):
            OptimizePrompt(project_id=PROJECT_ID, template_id=1, labeled_pdfs=[])

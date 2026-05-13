from uuid import uuid4

import pytest

from app.domains.chat_model_eval.application.commands import EvaluateChatModels


def test_command_requires_pdf_ids():
    with pytest.raises(ValueError, match="pdf_ids"):
        EvaluateChatModels(project_id=uuid4(), pdf_ids=[], chat_model_ids=["gpt-5.4-mini"])


def test_command_requires_chat_model_ids():
    with pytest.raises(ValueError, match="chat_model_ids"):
        EvaluateChatModels(project_id=uuid4(), pdf_ids=[uuid4()], chat_model_ids=[])


def test_command_requires_positive_beta():
    with pytest.raises(ValueError, match="beta"):
        EvaluateChatModels(
            project_id=uuid4(),
            pdf_ids=[uuid4()],
            chat_model_ids=["gpt-5.4-mini"],
            beta=0,
        )

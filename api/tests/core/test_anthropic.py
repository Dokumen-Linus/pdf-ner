from unittest.mock import MagicMock, patch

import pytest

from app.integrations.anthropic import call_anthropic_async


@pytest.fixture
def mock_llm_response():
    response = MagicMock()
    response.text = "response-text"
    response.input_tokens = 10
    response.output_tokens = 20
    return response


class TestCallAnthropicAsync:
    @pytest.mark.anyio
    async def test_success_records_telemetry(self, mock_llm_response):
        with patch("app.integrations.anthropic.call_anthropic", return_value=mock_llm_response):
            with patch("app.integrations.anthropic.record_llm_call") as mock_record:
                result = await call_anthropic_async(
                    MagicMock(), "claude-sonnet-4", "system", "user"
                )

            assert result == mock_llm_response
            mock_record.assert_called_once_with(
                provider="anthropic",
                model="claude-sonnet-4",
                prompt_tokens=10,
                completion_tokens=20,
                duration_s=pytest.approx(0, abs=1),
                success=True,
            )

    @pytest.mark.anyio
    async def test_failure_records_telemetry(self):
        with patch("app.integrations.anthropic.call_anthropic", side_effect=ValueError("fail")):
            with patch("app.integrations.anthropic.record_llm_call") as mock_record:
                with pytest.raises(ValueError):
                    await call_anthropic_async(MagicMock(), "claude-sonnet-4", "system", "user")

            mock_record.assert_called_once_with(
                provider="anthropic",
                model="claude-sonnet-4",
                prompt_tokens=None,
                completion_tokens=None,
                duration_s=pytest.approx(0, abs=1),
                success=False,
                error_type="ValueError",
            )

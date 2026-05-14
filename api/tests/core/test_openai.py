from unittest.mock import MagicMock, patch

import pytest

from app.integrations.openai import call_openai_async


@pytest.fixture
def mock_llm_response():
    response = MagicMock()
    response.text = "response-text"
    response.input_tokens = 15
    response.output_tokens = 25
    return response


class TestCallOpenaiAsync:
    @pytest.mark.anyio
    async def test_success_records_telemetry(self, mock_llm_response):
        with patch("app.integrations.openai.call_openai", return_value=mock_llm_response):
            with patch("app.integrations.openai.record_llm_call") as mock_record:
                result = await call_openai_async(MagicMock(), "gpt-4o", "system", "user")

            assert result == mock_llm_response
            mock_record.assert_called_once_with(
                provider="openai",
                model="gpt-4o",
                prompt_tokens=15,
                completion_tokens=25,
                duration_s=pytest.approx(0, abs=1),
                success=True,
            )

    @pytest.mark.anyio
    async def test_failure_records_telemetry(self):
        with patch("app.integrations.openai.call_openai", side_effect=ConnectionError("fail")):
            with patch("app.integrations.openai.record_llm_call") as mock_record:
                with pytest.raises(ConnectionError):
                    await call_openai_async(MagicMock(), "gpt-4o", "system", "user")

            mock_record.assert_called_once_with(
                provider="openai",
                model="gpt-4o",
                prompt_tokens=None,
                completion_tokens=None,
                duration_s=pytest.approx(0, abs=1),
                success=False,
                error_type="ConnectionError",
            )

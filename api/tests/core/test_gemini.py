from unittest.mock import MagicMock, patch

import pytest

from app.integrations.gemini import call_google_ai_async


@pytest.fixture
def mock_llm_response():
    response = MagicMock()
    response.text = "response-text"
    response.input_tokens = 5
    response.output_tokens = 15
    return response


class TestCallGoogleAiAsync:
    @pytest.mark.anyio
    async def test_success_records_telemetry(self, mock_llm_response):
        with patch("app.integrations.gemini.call_google_genai", return_value=mock_llm_response):
            with patch("app.integrations.gemini.record_llm_call") as mock_record:
                result = await call_google_ai_async(
                    MagicMock(), "gemini-2.0-flash", "system", "user"
                )

            assert result == mock_llm_response
            mock_record.assert_called_once_with(
                provider="gemini",
                model="gemini-2.0-flash",
                prompt_tokens=5,
                completion_tokens=15,
                duration_s=pytest.approx(0, abs=1),
                success=True,
            )

    @pytest.mark.anyio
    async def test_failure_records_telemetry(self):
        with patch("app.integrations.gemini.call_google_genai", side_effect=RuntimeError("fail")):
            with patch("app.integrations.gemini.record_llm_call") as mock_record:
                with pytest.raises(RuntimeError):
                    await call_google_ai_async(MagicMock(), "gemini-2.0-flash", "system", "user")

            mock_record.assert_called_once_with(
                provider="gemini",
                model="gemini-2.0-flash",
                prompt_tokens=None,
                completion_tokens=None,
                duration_s=pytest.approx(0, abs=1),
                success=False,
                error_type="RuntimeError",
            )

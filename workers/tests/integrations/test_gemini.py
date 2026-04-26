from unittest.mock import AsyncMock, MagicMock

import pytest

from app.integrations.gemini import call_google_genai


class TestCallGoogleGenai:
    @pytest.mark.anyio
    async def test_basic_call(self):
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(
            return_value=MagicMock(
                text="Gemini response",
                usage_metadata=MagicMock(prompt_token_count=13, candidates_token_count=8),
            )
        )

        result = await call_google_genai(mock_client, "gemini-2.0-flash", "system", "user")

        assert result.text == "Gemini response"
        assert result.input_tokens == 13
        assert result.output_tokens == 8
        mock_client.aio.models.generate_content.assert_awaited_once()

    @pytest.mark.anyio
    async def test_records_and_reraises_provider_error(self):
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(side_effect=RuntimeError("provider down"))

        with pytest.raises(RuntimeError, match="provider down"):
            await call_google_genai(mock_client, "gemini-2.0-flash", "system", "user")


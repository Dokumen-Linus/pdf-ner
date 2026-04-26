from unittest.mock import AsyncMock, MagicMock

import pytest

from app.integrations.anthropic import call_anthropic


class TestCallAnthropic:
    @pytest.mark.anyio
    async def test_basic_call(self):
        mock_client = AsyncMock()
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(text="Anthropic response")],
            usage=MagicMock(input_tokens=11, output_tokens=7),
        )

        result = await call_anthropic(mock_client, "claude-3-5-sonnet", "system", "user")

        assert result.text == "Anthropic response"
        assert result.input_tokens == 11
        assert result.output_tokens == 7
        mock_client.messages.create.assert_awaited_once()

    @pytest.mark.anyio
    async def test_records_and_reraises_provider_error(self):
        mock_client = AsyncMock()
        mock_client.messages.create.side_effect = RuntimeError("provider down")

        with pytest.raises(RuntimeError, match="provider down"):
            await call_anthropic(mock_client, "claude-3-5-sonnet", "system", "user")


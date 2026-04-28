from unittest.mock import AsyncMock, MagicMock

import pytest

from app.integrations.openai import call_openai


class TestCallOpenai:
    @pytest.mark.anyio
    async def test_basic_call(self):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Hello response"))],
            usage=MagicMock(prompt_tokens=10, completion_tokens=5),
        )

        result = await call_openai(mock_client, "gpt-4o", "system", "user")
        assert result.text == "Hello response"
        assert result.input_tokens == 10
        assert result.output_tokens == 5
        mock_client.chat.completions.create.assert_awaited_once()

    @pytest.mark.anyio
    async def test_passes_model_and_messages(self):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="ok"))]
        )

        await call_openai(mock_client, "gpt-4o-mini", "sys prompt", "user prompt")

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "gpt-4o-mini"
        assert call_kwargs["messages"][0] == {"role": "system", "content": "sys prompt"}
        assert call_kwargs["messages"][1] == {"role": "user", "content": "user prompt"}

    @pytest.mark.anyio
    async def test_temperature_and_max_tokens(self):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="ok"))]
        )

        await call_openai(mock_client, "gpt-4o", "sys", "user", temp=0.5, max_tokens=500)

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.5
        assert call_kwargs["max_tokens"] == 500

    @pytest.mark.anyio
    async def test_default_temperature(self):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="ok"))]
        )

        await call_openai(mock_client, "gpt-4o", "sys", "user")

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.01

    @pytest.mark.anyio
    async def test_with_json_schema(self):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content='{"name": "John"}'))]
        )

        schema = {"type": "object", "properties": {"name": {"type": "string"}}}
        result = await call_openai(
            mock_client, "gpt-4o", "sys", "user", schema=schema, schema_name="test_schema"
        )

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["response_format"]["type"] == "json_schema"
        assert call_kwargs["response_format"]["json_schema"]["name"] == "test_schema"
        assert call_kwargs["response_format"]["json_schema"]["strict"] is True
        assert call_kwargs["response_format"]["json_schema"]["schema"] is schema
        assert result.text == '{"name": "John"}'

    @pytest.mark.anyio
    async def test_schema_name_defaults_to_response(self):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="ok"))]
        )

        schema = {"type": "object"}
        await call_openai(mock_client, "gpt-4o", "sys", "user", schema=schema)

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["response_format"]["json_schema"]["name"] == "response"

    @pytest.mark.anyio
    async def test_no_response_format_without_schema(self):
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="ok"))]
        )

        await call_openai(mock_client, "gpt-4o", "sys", "user")

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert "response_format" not in call_kwargs

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dokumen_llm_providers import call_anthropic, call_google_genai, call_openai


@pytest.fixture
def mock_openai_client():
    client = MagicMock()
    choice = MagicMock()
    choice.message.content = "response-text"
    client.chat.completions.create = AsyncMock(
        return_value=MagicMock(
            choices=[choice],
            usage=MagicMock(prompt_tokens=15, completion_tokens=25),
        )
    )
    return client


@pytest.fixture
def mock_anthropic_client():
    client = MagicMock()
    client.messages.create = AsyncMock(
        return_value=MagicMock(
            content=[MagicMock(text="response-text")],
            usage=MagicMock(input_tokens=10, output_tokens=30),
        )
    )
    return client


@pytest.fixture
def mock_gemini_client():
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(
            text="response-text",
            usage_metadata=MagicMock(prompt_token_count=5, candidates_token_count=15),
        )
    )
    return client


@pytest.mark.asyncio
async def test_call_openai_returns_llm_response_data(mock_openai_client):
    result = await call_openai(
        mock_openai_client,
        model="gpt-4o",
        system_prompt="be helpful",
        user_prompt="hello",
    )
    assert result.text == "response-text"
    assert result.input_tokens == 15
    assert result.output_tokens == 25


@pytest.mark.asyncio
async def test_call_openai_with_schema(mock_openai_client):
    schema = {"type": "object", "properties": {"answer": {"type": "string"}}}
    result = await call_openai(
        mock_openai_client,
        model="gpt-4o",
        system_prompt="be helpful",
        user_prompt="hello",
        schema=schema,
        schema_name="my_schema",
    )
    assert result.text == "response-text"
    kwargs = mock_openai_client.chat.completions.create.await_args.kwargs
    assert kwargs["response_format"]["type"] == "json_schema"
    assert kwargs["response_format"]["json_schema"]["name"] == "my_schema"


@pytest.mark.asyncio
async def test_call_openai_with_schema_default_name(mock_openai_client):
    result = await call_openai(
        mock_openai_client,
        model="gpt-4o",
        system_prompt="be helpful",
        user_prompt="hello",
        schema={"type": "object"},
    )
    assert result.text == "response-text"
    kwargs = mock_openai_client.chat.completions.create.await_args.kwargs
    assert kwargs["response_format"]["json_schema"]["name"] == "response"


@pytest.mark.asyncio
async def test_call_openai_handles_null_usage(mock_openai_client):
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content="text"))],
            usage=None,
        )
    )
    result = await call_openai(
        mock_openai_client, model="gpt-4o", system_prompt="", user_prompt="hi"
    )
    assert result.input_tokens == 0
    assert result.output_tokens == 0


@pytest.mark.asyncio
async def test_call_openai_handles_empty_content(mock_openai_client):
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content=None))],
            usage=MagicMock(prompt_tokens=1, completion_tokens=2),
        )
    )
    result = await call_openai(
        mock_openai_client, model="gpt-4o", system_prompt="", user_prompt="hi"
    )
    assert result.text == ""


@pytest.mark.asyncio
async def test_call_anthropic_returns_llm_response_data(mock_anthropic_client):
    result = await call_anthropic(
        mock_anthropic_client,
        model="claude-sonnet-4",
        system_prompt="be concise",
        user_prompt="what is love",
    )
    assert result.text == "response-text"
    assert result.input_tokens == 10
    assert result.output_tokens == 30


@pytest.mark.asyncio
async def test_call_google_genai_returns_llm_response_data(mock_gemini_client):
    result = await call_google_genai(
        mock_gemini_client,
        model="gemini-2.0-flash",
        system_prompt="be concise",
        user_prompt="hello",
    )
    assert result.text == "response-text"
    assert result.input_tokens == 5
    assert result.output_tokens == 15


@pytest.mark.asyncio
async def test_call_google_genai_with_json_response(mock_gemini_client):
    result = await call_google_genai(
        mock_gemini_client,
        model="gemini-2.0-flash",
        system_prompt="be concise",
        user_prompt="hello",
        json_response=True,
    )
    assert result.text == "response-text"
    config_kwarg = mock_gemini_client.aio.models.generate_content.await_args.kwargs["config"]
    assert config_kwarg.response_mime_type == "application/json"


@pytest.mark.asyncio
async def test_call_google_genai_handles_null_usage(mock_gemini_client):
    mock_gemini_client.aio.models.generate_content = AsyncMock(
        return_value=MagicMock(
            text="response-text",
            usage_metadata=None,
        )
    )
    result = await call_google_genai(
        mock_gemini_client, model="gemini-2.0-flash", system_prompt="", user_prompt="hi"
    )
    assert result.input_tokens == 0
    assert result.output_tokens == 0

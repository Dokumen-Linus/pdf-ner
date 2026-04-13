import logging
import time

from anthropic import AsyncAnthropic
from google.genai import Client, types
from openai import AsyncOpenAI

from .types import LLMResponseData

logger = logging.getLogger(__name__)


async def call_openai(
    client: AsyncOpenAI,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema: dict | None = None,
    schema_name: str | None = None,
    temp: float = 0.01,
    max_tokens: int = 10**4,
) -> LLMResponseData:
    logger.info("OpenAI call started: model=%s", model)
    start = time.perf_counter()

    kwargs: dict = {
        "model": model,
        "temperature": temp,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    if schema is not None:
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name or "response",
                "schema": schema,
                "strict": True,
            },
        }

    response = await client.chat.completions.create(**kwargs)
    usage = response.usage
    input_tokens = usage.prompt_tokens if usage else 0
    output_tokens = usage.completion_tokens if usage else 0

    duration = time.perf_counter() - start
    logger.info(
        "OpenAI call completed: model=%s, duration=%.2fs, in=%d, out=%d",
        model,
        duration,
        input_tokens,
        output_tokens,
    )
    return LLMResponseData(
        text=response.choices[0].message.content or "",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


async def call_anthropic(
    client: AsyncAnthropic,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temp: float = 0.01,
    max_tokens: int = 10**4,
) -> LLMResponseData:
    logger.info("Anthropic call started: model=%s", model)
    start = time.perf_counter()

    response = await client.messages.create(
        model=model,
        temperature=temp,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    duration = time.perf_counter() - start
    logger.info(
        "Anthropic call completed: model=%s, duration=%.2fs, in=%d, out=%d",
        model,
        duration,
        response.usage.input_tokens,
        response.usage.output_tokens,
    )
    return LLMResponseData(
        text=response.content[0].text,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
    )


async def call_google_genai(
    client: Client,
    model: str,
    system_prompt: str,
    user_prompt: str,
    json_response: bool = False,
    temp: float = 0.01,
    max_tokens: int = 10**4,
) -> LLMResponseData:
    logger.info("Gemini call started: model=%s", model)
    start = time.perf_counter()

    response = await client.aio.models.generate_content(
        model=model,
        config=types.GenerateContentConfig(
            temperature=temp,
            max_output_tokens=max_tokens,
            system_instruction=system_prompt,
            response_mime_type="application/json" if json_response else "text/plain",
        ),
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])],
    )

    usage = response.usage_metadata
    input_tokens = usage.prompt_token_count if usage else 0
    output_tokens = usage.candidates_token_count if usage else 0

    duration = time.perf_counter() - start
    logger.info(
        "Gemini call completed: model=%s, duration=%.2fs, in=%d, out=%d",
        model,
        duration,
        input_tokens,
        output_tokens,
    )
    return LLMResponseData(
        text=response.text or "",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )

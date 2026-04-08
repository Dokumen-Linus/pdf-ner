import logging
import time

from app.domains.shared.schemas import LLMResponseData
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


async def call_openai_async(
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

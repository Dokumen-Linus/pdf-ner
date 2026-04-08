import logging
import time

from anthropic import AsyncAnthropic
from app.domains.shared.schemas import LLMResponseData

logger = logging.getLogger(__name__)


async def call_anthropic_async(
    client: AsyncAnthropic,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temp: int = 0.01,
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

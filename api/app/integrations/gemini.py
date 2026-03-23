import logging
import time

from google.genai import Client, types

logger = logging.getLogger(__name__)


async def call_google_ai_async(
    client: Client,
    model: str,
    system_prompt: str,
    user_prompt: str,
    json_response: bool = False,
    temp: int = 0.01,
    max_tokens: int = 10**4,
) -> str:
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

    duration = time.perf_counter() - start
    logger.info("Gemini call completed: model=%s, duration=%.2fs", model, duration)
    return response.text

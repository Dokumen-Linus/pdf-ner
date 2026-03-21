from openai import AsyncOpenAI

async def call_openai_async(
    client: AsyncOpenAI,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema: dict | None = None,
    schema_name: str | None = None,
    temp: float = 0.01,
    max_tokens: int = 10**4,
) -> str:
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
    return response.choices[0].message.content

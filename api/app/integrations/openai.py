from openai import AsyncOpenAI

async def call_openai_async(client: AsyncOpenAI,  model: str, system_prompt: str, user_prompt: str,
                            temp: int = 0.01, max_tokens: int = 2048) -> str:
    response = await client.chat.completions.create(
        model=model,
        temperature=temp,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content
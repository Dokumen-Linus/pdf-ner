from anthropic import AsyncAnthropic

async def call_anthropic_async(client: AsyncAnthropic,  model: str, system_prompt: str, user_prompt: str,
                            temp: int = 0.01, max_tokens: int = 2048) -> str:
  response = await client.messages.create(
        model=model,
        temperature=temp,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_prompt}
        ]
    )
  return response.content[0].text
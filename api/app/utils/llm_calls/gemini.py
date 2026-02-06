from google.genai import Client, types

async def call_google_ai_async(
    client: Client,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temp: int = 0.01,
    max_tokens: int = 2048,
) -> str:
    response = await client.aio.models.generate_content(
        model=model,
        config=types.GenerateContentConfig(
            temperature=temp,
            max_output_tokens=max_tokens,
            system_instruction=system_prompt,
            response_mime_type="application/json",
        ),
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])],
    )

    return response.text

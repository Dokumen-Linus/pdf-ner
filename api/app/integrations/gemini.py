from dokumen_llm_providers import LLMResponseData, call_google_genai


async def call_google_ai_async(*args, **kwargs) -> LLMResponseData:
    return await call_google_genai(*args, **kwargs)

from dokumen_llm_providers import LLMResponseData, call_openai


async def call_openai_async(*args, **kwargs) -> LLMResponseData:
    return await call_openai(*args, **kwargs)

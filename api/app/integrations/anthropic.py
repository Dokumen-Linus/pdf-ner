from dokumen_llm_providers import LLMResponseData, call_anthropic


async def call_anthropic_async(*args, **kwargs) -> LLMResponseData:
    return await call_anthropic(*args, **kwargs)

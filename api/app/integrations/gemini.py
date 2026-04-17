import time

from dokumen_llm_providers import LLMResponseData, call_google_genai

from app.core.telemetry import bind_request_context

import sys
from pathlib import Path

_OBS_PATH = Path(__file__).resolve().parents[3] / "packages" / "otel_py"
if str(_OBS_PATH) not in sys.path:
    sys.path.insert(0, str(_OBS_PATH))

from otel_py import record_llm_call  # noqa: E402


async def call_google_ai_async(*args, **kwargs) -> LLMResponseData:
    model = kwargs.get("model") or (args[1] if len(args) > 1 else "unknown")
    bind_request_context(llm_provider="gemini", llm_model=model)
    start = time.perf_counter()
    try:
        response = await call_google_genai(*args, **kwargs)
    except Exception as exc:
        record_llm_call(
            provider="gemini",
            model=model,
            prompt_tokens=None,
            completion_tokens=None,
            duration_s=time.perf_counter() - start,
            success=False,
            error_type=type(exc).__name__,
        )
        raise

    record_llm_call(
        provider="gemini",
        model=model,
        prompt_tokens=response.input_tokens,
        completion_tokens=response.output_tokens,
        duration_s=time.perf_counter() - start,
        success=True,
    )
    return response

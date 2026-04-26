from pathlib import Path
import sys
import time

from anthropic import AsyncAnthropic
from dokumen_llm_providers import LLMResponseData
from dokumen_llm_providers import call_anthropic as _call_anthropic

from app.core.logging import bind_worker_context

_OBS_PATH = Path(__file__).resolve().parents[3] / "packages" / "otel_py"
if str(_OBS_PATH) not in sys.path:
    sys.path.insert(0, str(_OBS_PATH))

from otel_py import record_llm_call  # noqa: E402

__all__ = ["AsyncAnthropic", "call_anthropic"]


async def call_anthropic(*args, **kwargs) -> LLMResponseData:
    model = kwargs.get("model") or (args[1] if len(args) > 1 else "unknown")
    bind_worker_context(llm_provider="anthropic", llm_model=model)
    start = time.perf_counter()
    try:
        response = await _call_anthropic(*args, **kwargs)
    except Exception as exc:
        record_llm_call(
            provider="anthropic",
            model=model,
            prompt_tokens=None,
            completion_tokens=None,
            duration_s=time.perf_counter() - start,
            success=False,
            error_type=type(exc).__name__,
        )
        raise

    record_llm_call(
        provider="anthropic",
        model=model,
        prompt_tokens=response.input_tokens,
        completion_tokens=response.output_tokens,
        duration_s=time.perf_counter() - start,
        success=True,
    )
    return response

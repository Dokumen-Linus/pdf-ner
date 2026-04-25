from contextlib import asynccontextmanager
import os
from threading import Lock
from typing import Any

import anyio
from fastapi import FastAPI, Request, Response
from PIL import Image
from shared.ocr import read_png_image
from shared.runpod_http import ensure_ready, normalize_text, readiness_response, run_app
from vllm import LLM, SamplingParams
from vllm.model_executor.models.deepseek_ocr import NGramPerReqLogitsProcessor

MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-ai/DeepSeek-OCR")
OCR_PROMPT = os.getenv("OCR_PROMPT", "<image>\nFree OCR.")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "2048"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.0"))
NGRAM_SIZE = int(os.getenv("NGRAM_SIZE", "30"))
NGRAM_WINDOW_SIZE = int(os.getenv("NGRAM_WINDOW_SIZE", "90"))

_generation_lock = Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ready = False
    app.state.llm = _load_model()
    app.state.sampling_params = _sampling_params()
    app.state.ready = True
    yield


app = FastAPI(title="DeepSeek OCR Runpod Worker", lifespan=lifespan)


@app.get("/ping")
async def ping(request: Request) -> Response:
    return readiness_response(request)


@app.post("/ocr")
async def ocr(request: Request) -> dict[str, Any]:
    ensure_ready(request)
    image = await read_png_image(request)
    result = await anyio.to_thread.run_sync(
        _generate_text,
        request.app.state.llm,
        request.app.state.sampling_params,
        image,
    )
    return result


def _load_model() -> LLM:
    return LLM(
        model=MODEL_NAME,
        enable_prefix_caching=False,
        mm_processor_cache_gb=0,
        logits_processors=[NGramPerReqLogitsProcessor],
    )


def _sampling_params() -> SamplingParams:
    return SamplingParams(
        temperature=TEMPERATURE,
        max_tokens=MAX_TOKENS,
        extra_args={
            "ngram_size": NGRAM_SIZE,
            "window_size": NGRAM_WINDOW_SIZE,
        },
    )


def _generate_text(llm: LLM, sampling_params: SamplingParams, image: Image.Image) -> dict[str, Any]:
    model_input = {
        "prompt": OCR_PROMPT,
        "multi_modal_data": {"image": image},
    }

    with _generation_lock:
        outputs = llm.generate([model_input], sampling_params=sampling_params)

    request_output = outputs[0]
    completion = request_output.outputs[0]
    text = normalize_text(completion.text)

    return {
        "text": text,
        "model": MODEL_NAME,
        "finish_reason": getattr(completion, "finish_reason", None),
        "usage": {
            "prompt_tokens": len(getattr(request_output, "prompt_token_ids", []) or []),
            "completion_tokens": len(getattr(completion, "token_ids", []) or []),
        },
    }


if __name__ == "__main__":
    run_app(app)

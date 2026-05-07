from contextlib import asynccontextmanager
import os
from threading import Lock
from typing import Any

import anyio
from fastapi import FastAPI, Request, Response
from olmocr.prompts import build_no_anchoring_v4_yaml_prompt
from PIL import Image
from shared.ocr import (
    read_png_image,
    resize_longest_dimension,
    split_yaml_front_matter,
)
from shared.runpod_http import ensure_ready, normalize_text, readiness_response, run_app
from transformers import AutoProcessor
from vllm import LLM, SamplingParams

MODEL_NAME = os.getenv("MODEL_NAME", "allenai/olmOCR-2-7B-1025-FP8")
PROCESSOR_NAME = os.getenv("PROCESSOR_NAME", "Qwen/Qwen2.5-VL-7B-Instruct")
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "8000"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.1"))
TARGET_LONGEST_IMAGE_DIM = int(os.getenv("TARGET_LONGEST_IMAGE_DIM", "1288"))
GPU_MEMORY_UTILIZATION = float(os.getenv("GPU_MEMORY_UTILIZATION", "0.9"))
MAX_MODEL_LEN = os.getenv("MAX_MODEL_LEN")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ready = False
    app.state.processor = AutoProcessor.from_pretrained(PROCESSOR_NAME)
    app.state.llm = _load_model()
    app.state.sampling_params = _sampling_params()
    app.state.generation_lock = Lock()
    app.state.ready = True
    yield


app = FastAPI(title="olmOCR2 Runpod Worker", lifespan=lifespan)


@app.get("/ping")
async def ping(request: Request) -> Response:
    return readiness_response(request)


@app.post("/ocr")
async def ocr(request: Request) -> dict[str, Any]:
    ensure_ready(request)
    image = await read_png_image(
        request,
        transform=lambda prepared: resize_longest_dimension(prepared, TARGET_LONGEST_IMAGE_DIM),
    )
    result = await anyio.to_thread.run_sync(
        _generate_text,
        request.app.state.llm,
        request.app.state.sampling_params,
        request.app.state.processor,
        request.app.state.generation_lock,
        image,
    )
    return result


def _load_model() -> LLM:
    kwargs: dict[str, Any] = {}
    if MAX_MODEL_LEN:
        kwargs["max_model_len"] = int(MAX_MODEL_LEN)

    return LLM(
        model=MODEL_NAME,
        trust_remote_code=True,
        gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
        limit_mm_per_prompt={"image": 1},
        **kwargs,
    )


def _sampling_params() -> SamplingParams:
    return SamplingParams(
        temperature=TEMPERATURE,
        max_tokens=MAX_NEW_TOKENS,
    )


def _generate_text(
    llm: LLM,
    sampling_params: SamplingParams,
    processor: AutoProcessor,
    generation_lock: Lock,
    image: Image.Image,
) -> dict[str, Any]:
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": build_no_anchoring_v4_yaml_prompt()},
            ],
        }
    ]
    prompt = processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    model_input = {
        "prompt": prompt,
        "multi_modal_data": {"image": image},
    }

    with generation_lock:
        outputs = llm.generate([model_input], sampling_params=sampling_params)

    request_output = outputs[0]
    completion = request_output.outputs[0]
    text_output = completion.text
    metadata, text = split_yaml_front_matter(text_output)

    return {
        "text": normalize_text(text),
        "model": MODEL_NAME,
        "finish_reason": getattr(completion, "finish_reason", None),
        "usage": {
            "prompt_tokens": len(getattr(request_output, "prompt_token_ids", []) or []),
            "completion_tokens": len(getattr(completion, "token_ids", []) or []),
        },
        "metadata": metadata,
    }


if __name__ == "__main__":
    run_app(app)

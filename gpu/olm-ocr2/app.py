from contextlib import asynccontextmanager
import os
from typing import Any

import anyio
from fastapi import FastAPI, Request, Response
from olmocr.prompts import build_no_anchoring_v4_yaml_prompt
from PIL import Image
from shared.ocr import (
    image_to_base64_png,
    read_png_image,
    resize_longest_dimension,
    split_yaml_front_matter,
)
from shared.runpod_http import ensure_ready, normalize_text, readiness_response, run_app
import torch
from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

MODEL_NAME = os.getenv("MODEL_NAME", "allenai/olmOCR-2-7B-1025-FP8")
PROCESSOR_NAME = os.getenv("PROCESSOR_NAME", "Qwen/Qwen2.5-VL-7B-Instruct")
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "8000"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.1"))
TARGET_LONGEST_IMAGE_DIM = int(os.getenv("TARGET_LONGEST_IMAGE_DIM", "1288"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ready = False
    app.state.processor = AutoProcessor.from_pretrained(PROCESSOR_NAME)
    app.state.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_NAME,
        device_map="auto",
    ).eval()
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
        request.app.state.model,
        request.app.state.processor,
        image,
    )
    return result


def _generate_text(
    model: Qwen2_5_VLForConditionalGeneration,
    processor: AutoProcessor,
    image: Image.Image,
) -> dict[str, Any]:
    image_base64 = image_to_base64_png(image)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": build_no_anchoring_v4_yaml_prompt()},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_base64}"},
                },
            ],
        }
    ]
    prompt = processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = processor(
        text=[prompt],
        images=[image],
        padding=True,
        return_tensors="pt",
    )
    inputs = {key: value.to(model.device) for key, value in inputs.items()}

    with torch.inference_mode():
        output = model.generate(
            **inputs,
            temperature=TEMPERATURE,
            max_new_tokens=MAX_NEW_TOKENS,
            num_return_sequences=1,
            do_sample=TEMPERATURE > 0,
        )

    prompt_length = inputs["input_ids"].shape[1]
    new_tokens = output[:, prompt_length:]
    text_output = processor.tokenizer.batch_decode(new_tokens, skip_special_tokens=True)[0]
    metadata, text = split_yaml_front_matter(text_output)

    return {
        "text": normalize_text(text),
        "model": MODEL_NAME,
        "finish_reason": None,
        "usage": {
            "prompt_tokens": int(prompt_length),
            "completion_tokens": int(new_tokens.shape[1]),
        },
        "metadata": metadata,
    }


if __name__ == "__main__":
    run_app(app)

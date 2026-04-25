# GPU Runpod Workers

This directory contains the Runpod Serverless HTTP workers used for OCR. Both workers expose the same request shape, return normalized JSON, and share common FastAPI/image helpers from `gpu/shared`.

## Layout

- `gpu/deepseek-ocr` - DeepSeek OCR worker backed by vLLM
- `gpu/olm-ocr2` - olmOCR2 worker backed by `transformers`
- `gpu/shared` - shared HTTP and image helpers for current and future workers

## HTTP Contract

Both workers expose:

- `GET /ping` - readiness probe
  - `204` while the model is still loading
  - `200` once ready
- `POST /ocr` - OCR request
  - body: raw PNG bytes
  - header: `Content-Type: image/png`

Canonical response shape:

```json
{
  "text": "extracted text",
  "model": "model name or id",
  "finish_reason": null,
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0
  }
}
```

The `olmOCR2` worker also returns a `metadata` object when the model emits one.

## Local Build

Build from the `gpu` directory so the Dockerfiles can copy the shared package:

```bash
cd gpu
docker build -f deepseek-ocr/Dockerfile -t deepseek-ocr-runpod .
docker build -f olm-ocr2/Dockerfile -t olm-ocr2-runpod .
```

## Local Run

Each image expects an NVIDIA GPU runtime.

```bash
docker run --gpus all --rm -p 8000:8000 deepseek-ocr-runpod
docker run --gpus all --rm -p 8000:8000 olm-ocr2-runpod
```

Smoke test with a PNG:

```bash
curl -X POST http://localhost:8000/ocr \
  -H "Content-Type: image/png" \
  --data-binary @page.png
```

## Deploying a New Runpod Serverless Endpoint

These workers are designed for **Runpod Serverless load-balancing endpoints**, not queue-based `/run` or `/runsync` workers. Load-balancing endpoints let the worker serve custom HTTP routes directly.

Reference docs:

- [Runpod load balancing overview](https://docs.runpod.io/serverless/load-balancing/overview)
- [Build a load balancing worker](https://docs.runpod.io/serverless/load-balancing/build-a-worker)
- [Create a Dockerfile](https://docs.runpod.io/serverless/workers/create-dockerfile)

1. Build the image locally and push it to a registry such as Docker Hub.

```bash
cd gpu
docker build --platform linux/amd64 -f deepseek-ocr/Dockerfile -t DOCKER_USER/deepseek-ocr-runpod:latest .
docker push DOCKER_USER/deepseek-ocr-runpod:latest
```

Use `olm-ocr2/Dockerfile` and a different tag for the olmOCR2 worker.

2. In the Runpod console, create a new Serverless endpoint.

- Choose **Load Balancing** as the endpoint type.
- Import the image from your registry.
- Select the GPU type and replica settings you want.
- Keep the container port aligned with `PORT` if you change it from the default
  `8000`.

3. Set the worker environment variables in the endpoint config.

- DeepSeek OCR worker:
  - `MODEL_NAME`
  - `OCR_PROMPT`
  - `MAX_TOKENS`
  - `TEMPERATURE`
  - `NGRAM_SIZE`
  - `NGRAM_WINDOW_SIZE`
- olmOCR2 worker:
  - `MODEL_NAME`
  - `PROCESSOR_NAME`
  - `MAX_NEW_TOKENS`
  - `TEMPERATURE`
  - `TARGET_LONGEST_IMAGE_DIM`

4. Deploy the endpoint and verify readiness.

```bash
curl https://ENDPOINT_ID.api.runpod.ai/ping
curl -X POST https://ENDPOINT_ID.api.runpod.ai/ocr \
  -H "Authorization: Bearer RUNPOD_API_KEY" \
  -H "Content-Type: image/png" \
  --data-binary @page.png
```

The OCR client in `packages/pdf_ocr_utils` receives the full `/ocr` URL explicitly. It does not read Runpod endpoint configuration from environment variables.

## Notes for Future Workers

Keep model-specific logic inside the worker directory and move shared request, image, and HTTP helpers into `gpu/shared` so new Runpod services can reuse them.

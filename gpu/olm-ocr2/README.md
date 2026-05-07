# olmOCR2 Worker

FastAPI worker for `allenai/olmOCR-2-7B-1025-FP8` running with vLLM on Runpod Serverless.

See [../README.md](../README.md) for build and deployment instructions.

## Contract

- `GET /ping` returns `204` while loading and `200` once ready
- `POST /ocr` accepts raw PNG bytes with `Content-Type: image/png`
- Response is normalized JSON with `text`, `model`, `finish_reason`,
  `usage`, and `metadata`

## Worker Settings

Set these in the Runpod endpoint environment:

- `MODEL_NAME`
- `PROCESSOR_NAME`
- `MAX_NEW_TOKENS`
- `TEMPERATURE`
- `TARGET_LONGEST_IMAGE_DIM`
- `GPU_MEMORY_UTILIZATION`
- `MAX_MODEL_LEN`

## Local Dev

```bash
docker build -f olm-ocr2/Dockerfile -t olm-ocr2-runpod .
docker run --gpus all --rm -p 8000:8000 olm-ocr2-runpod
```

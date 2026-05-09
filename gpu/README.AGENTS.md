# GPU

## Layout

- `gpu/deepseek-ocr`: DeepSeek OCR worker backed by vLLM
- `gpu/olm-ocr2`: olmOCR2 worker backed by vLLM
- `gpu/shared`: shared HTTP and image helpers for current and future workers

## HTTP Contract

- `GET /ping` is the readiness probe
  - Return `204` while the model is still loading
  - Return `200` once ready
- `POST /ocr` accepts raw PNG bytes with `Content-Type: image/png`
- Canonical response fields are `text`, `model`, `finish_reason`, and `usage`
- `olmOCR2` may also return `metadata` when the model emits it

## Future Worker Guidance

- Keep model-specific logic inside the worker directory
- Move reusable request, image, and HTTP helpers into `gpu/shared`
- These workers are designed for Runpod Serverless load-balancing endpoints that serve custom HTTP routes directly

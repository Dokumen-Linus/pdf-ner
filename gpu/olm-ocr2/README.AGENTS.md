# olmOCR2 Worker Agent Notes

## Purpose

- FastAPI worker for `allenai/olmOCR-2-7B-1025-FP8` running with vLLM on Runpod Serverless.
- Build and deployment conventions live at the `gpu/` level; keep this worker focused on olmOCR2-specific behavior.

## Contract

- `GET /ping` returns `204` while loading and `200` once ready.
- `POST /ocr` accepts raw PNG bytes with `Content-Type: image/png`.
- Response is normalized JSON with `text`, `model`, `finish_reason`, `usage`, and `metadata`.

## Settings

- Worker-specific environment settings are `MODEL_NAME`, `PROCESSOR_NAME`, `MAX_NEW_TOKENS`, `TEMPERATURE`, `TARGET_LONGEST_IMAGE_DIM`, `GPU_MEMORY_UTILIZATION`, and `MAX_MODEL_LEN`.
- Add new environment variables to the relevant `.env.example`; never read or edit `.env` files.

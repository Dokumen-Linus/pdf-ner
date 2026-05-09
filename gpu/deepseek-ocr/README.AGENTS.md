# DeepSeek OCR

## Purpose

- FastAPI worker for `deepseek-ai/DeepSeek-OCR` running on Runpod Serverless
- Build and deployment conventions live at the `gpu/` level; keep this worker focused on DeepSeek-specific behavior

## Contract

- `GET /ping` returns `204` while loading and `200` once ready
- `POST /ocr` accepts raw PNG bytes with `Content-Type: image/png`
- Response is normalized JSON with `text`, `model`, `finish_reason`, and `usage`

## Settings

- Worker-specific environment settings are `MODEL_NAME`, `OCR_PROMPT`, `MAX_TOKENS`, `TEMPERATURE`, `NGRAM_SIZE`, and `NGRAM_WINDOW_SIZE`
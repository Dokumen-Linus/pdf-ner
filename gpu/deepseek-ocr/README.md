# DeepSeek OCR Worker

FastAPI worker for `deepseek-ai/DeepSeek-OCR` running on Runpod Serverless.

See [../README.md](../README.md) for build and deployment instructions.

## Contract

- `GET /ping` returns `204` while loading and `200` once ready
- `POST /ocr` accepts raw PNG bytes with `Content-Type: image/png`
- Response is normalized JSON with `text`, `model`, `finish_reason`, and
  `usage`

## Worker Settings

Set these in the Runpod endpoint environment:

- `MODEL_NAME`
- `OCR_PROMPT`
- `MAX_TOKENS`
- `TEMPERATURE`
- `NGRAM_SIZE`
- `NGRAM_WINDOW_SIZE`

## Local Dev

```bash
docker build -f deepseek-ocr/Dockerfile -t deepseek-ocr-runpod .
docker run --gpus all --rm -p 8000:8000 deepseek-ocr-runpod
```

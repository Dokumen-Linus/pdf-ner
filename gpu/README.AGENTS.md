# GPU Runpod Pod Workers

This directory contains the GPU OCR services for Dokumen AI. The services run
as fixed Runpod Pods, not Runpod Serverless endpoints, because Serverless queue
time and cold-start behavior are not a good fit for these OCR workloads.

The two deployed Pods are:

- `deepseek-ocr` backed by `deepseek-ai/DeepSeek-OCR`
- `olm-ocr2` backed by `allenai/olmOCR-2-7B-1025-FP8`

Both images are built from this `gpu/` Docker context so they can copy shared
helpers from `gpu/shared`.

## Runtime Contract

Both workers expose the same HTTP API on port `8000`:

- `GET /ping`
  - returns `204` while the model is still loading
  - returns `200` once ready
  - does not require bearer auth
- `POST /ocr`
  - requires `Authorization: Bearer $OCR_HTTP_BEARER_TOKEN`
  - accepts raw PNG bytes with `Content-Type: image/png`
  - returns normalized JSON

Canonical response:

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

The `olmOCR2` worker may also return `metadata`.

## Storage Rules

Runpod Pods have container disk and Pod volume disk. The workers expect the
deployment to mount Pod volume disk at `/workspace` and intentionally use disks
differently:

- Model caches live on Pod volume disk under `/workspace/dokumen-ocr/<worker>/`.
- Hugging Face cache uses `HF_HOME=/workspace/dokumen-ocr/<worker>/huggingface`.
- vLLM cache uses `VLLM_CACHE_ROOT=/workspace/dokumen-ocr/<worker>/vllm`.
- General cache uses `XDG_CACHE_HOME=/workspace/dokumen-ocr/<worker>/cache`.
- Temporary files and transient image work use container disk under
  `/tmp/dokumen-ocr/<worker>`.
- Network volumes must not be attached or used.

Stopping or restarting a Pod preserves its volume disk. Terminating/deleting a
Pod deletes the volume disk and therefore deletes the downloaded model cache.

## Deployment

Deployment and operator procedures live in `infra/runpod/README.AGENTS.md`.

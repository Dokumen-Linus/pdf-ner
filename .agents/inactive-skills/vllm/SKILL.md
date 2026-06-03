---
name: vllm
description: Use when building, modifying, or reviewing vLLM-backed GPU model workers, multimodal inference services, Runpod Serverless endpoints, FastAPI model-serving routes, SamplingParams configuration, model loading, or OCR-style GPU services in this repo.
---

# vLLM GPU Workers

Use this skill for repo-local vLLM workers, especially under `gpu/`.

## Before changing code

- Read `.codesight/wiki/index.md`, `.codesight/wiki/overview.md`, the relevant domain article, `gpu/README.AGENTS.md`, the relevant worker `README.AGENTS.md`, and the actual source files.
- Keep the change scoped to GPU worker behavior. Do not touch web, API, workers, DB, env files, generated files, or unrelated deployment files unless the task explicitly requires it.
- Respect the existing Runpod Serverless shape: custom FastAPI routes run inside each worker image.

## Worker structure

- Keep model-specific loading, prompt construction, preprocessing, sampling, and output parsing inside the worker directory.
- Move reusable request parsing, image preparation, HTTP readiness, and normalization helpers into `gpu/shared`.
- Keep `/ping` as the readiness probe:
  - return `204` while the model is still loading
  - return `200` once the worker is ready
- For OCR workers, keep `/ocr` accepting raw PNG bytes with `Content-Type: image/png`.
- Normalize OCR responses to `text`, `model`, `finish_reason`, and `usage`.
- Include model-specific response fields such as `metadata` only when the worker contract already establishes them.

## vLLM implementation pattern

- Load the model in FastAPI lifespan and set readiness only after model, processors, and sampling parameters are initialized.
- Build `SamplingParams` in a small helper and keep its values environment-driven.
- Run blocking `llm.generate(...)` calls through `anyio.to_thread.run_sync` from async routes.
- Protect shared model generation with a lock unless the worker has been explicitly designed and verified for safe concurrent generation.
- Pass multimodal inputs using the vLLM `multi_modal_data` shape already used by the repo workers.
- Normalize model text before returning it.

## Model configuration

- Configure `LLM(...)` with model-specific options only when the model requires them or existing worker behavior justifies them.
- Common options to consider include `trust_remote_code`, `gpu_memory_utilization`, `max_model_len`, `limit_mm_per_prompt`, prefix caching settings, multimodal processor cache settings, and logits processors.
- Keep env var names worker-specific and document them in that worker's `README.AGENTS.md` when adding or changing settings.
- Treat token counts derived from vLLM output token IDs as usage metadata, not billing truth unless the owning usage subsystem explicitly consumes and records them.

## Validation

- Run focused tests or import checks for touched worker code when practical.
- For docs-only skill changes, validate the skill folder with:

```bash
/Users/mehuljasti/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/vllm
```

# Runpod OCR Deployment

This folder deploys the two GPU OCR workers in `gpu/` to Runpod Serverless:

- `deepseek-ocr` using `deepseek-ai/DeepSeek-OCR`
- `olm-ocr2` using `allenai/olmOCR-2-7B-1025-FP8`

Both workers expose the same load-balancing HTTP contract:

- `GET /ping`
- `POST /ocr` with raw PNG bytes and `Content-Type: image/png`

Runpod load-balancing endpoints are required here because these workers use
custom FastAPI routes, raw PNG request bodies, and vLLM-managed model serving.
Do not use queue-based `/run` or `/runsync` URLs for these workers.

## References

- Runpod load balancing overview: https://docs.runpod.io/serverless/load-balancing/overview
- Runpod load-balancing vLLM guide: https://docs.runpod.io/serverless/load-balancing/vllm-worker
- Runpod endpoint API: https://docs.runpod.io/api-reference/endpoints/POST/endpoints
- Runpod template API: https://docs.runpod.io/api-reference/templates/POST/templates
- vLLM GPU install docs: https://docs.vllm.ai/en/latest/getting_started/installation/gpu/
- vLLM supported models: https://docs.vllm.ai/en/latest/models/supported_models/
- DeepSeek-OCR vLLM recipe: https://docs.vllm.ai/projects/recipes/en/latest/DeepSeek/DeepSeek-OCR.html
- olmOCR2 model card: https://huggingface.co/allenai/olmOCR-2-7B-1025-FP8

## Before You Start

Run these scripts on a Linux machine. vLLM is not installed for Windows and is
not run locally by this workflow.

Install and authenticate:

```bash
curl -sSL https://cli.runpod.net | bash
runpodctl doctor
docker login -u DOCKERHUB_USERNAME
```

The scripts also require:

```bash
sudo apt-get update
sudo apt-get install -y curl jq
```

Set up local deploy configuration:

```bash
cp infra/runpod/.env.example infra/runpod/.env.local
```

Edit `infra/runpod/.env.local` and set:

- `DOCKERHUB_NAMESPACE`
- `IMAGE_TAG`
- `RUNPOD_API_KEY`
- optional `HF_TOKEN` for private or gated Hugging Face models

Use an explicit image tag such as `v0.1.0`. Do not use `latest`.

## Deploy

From the repo root:

```bash
bash infra/runpod/runpod-setup.sh
```

The script builds from `gpu/`, not from each worker directory, so both images
receive the shared code from `gpu/shared`.

It builds and pushes:

```bash
docker build --platform linux/amd64 -f deepseek-ocr/Dockerfile -t "$DEEPSEEK_IMAGE" gpu
docker build --platform linux/amd64 -f olm-ocr2/Dockerfile -t "$OLM_OCR2_IMAGE" gpu
```

Then it creates or updates one private Serverless template per worker and one
Runpod Serverless endpoint per worker using:

- GPU: `NVIDIA GeForce RTX 5090`
- CUDA: `12.8`, `12.9`, or `13.0`
- exposed HTTP port: `8000/http`
- health port: `PORT_HEALTH=8000`

Endpoint and template IDs are written to:

```text
infra/runpod/local-state/runpod-state.json
```

That file is gitignored because it is local deployment state.

## Configure Dokumen Secrets

After deploy, copy the endpoint URLs from the setup summary into the reviewed
`prod/runpod` secret draft:

```json
{
  "DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL": "https://DEEPSEEK_ENDPOINT_ID.api.runpod.ai/ocr",
  "OLM_OCR2_RUNPOD_ENDPOINT_URL": "https://OLM_ENDPOINT_ID.api.runpod.ai/ocr"
}
```

These are load-balancing direct URLs. They are intentionally not:

```text
https://api.runpod.ai/v2/ENDPOINT_ID/runsync
```

## Test Deployed Endpoints

From the repo root:

```bash
bash infra/runpod/test-endpoints.sh
```

The test script reads endpoint IDs from `infra/runpod/local-state/runpod-state.json`
when available. You can also pass them explicitly:

```bash
DEEPSEEK_ENDPOINT_ID=... OLM_OCR2_ENDPOINT_ID=... bash infra/runpod/test-endpoints.sh
```

The smoke test:

- polls `/ping` until the worker returns `200`
- treats `204`, `502`, and `no workers available` as cold-start states
- posts a small PNG to `/ocr`
- asserts the response has `text`, `model`, and `usage`

## Console Fallback

If Runpod changes the REST API behavior for load-balancing endpoint creation,
set this in `infra/runpod/.env.local`:

```bash
RUNPOD_CREATE_ENDPOINTS=0
```

Then run `runpod-setup.sh` to build images and create templates only. In the
Runpod console, create two Serverless endpoints from those templates and choose
Endpoint Type: Load Balancer. Afterward, run:

```bash
DEEPSEEK_ENDPOINT_ID=... OLM_OCR2_ENDPOINT_ID=... bash infra/runpod/test-endpoints.sh
```

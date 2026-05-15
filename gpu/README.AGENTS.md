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

Runpod Pods have container disk and Pod volume disk. This project intentionally
uses them differently:

- Model caches live on Pod volume disk under `/workspace/dokumen-ocr/<worker>/`.
- Hugging Face cache uses `HF_HOME=/workspace/dokumen-ocr/<worker>/huggingface`.
- vLLM cache uses `VLLM_CACHE_ROOT=/workspace/dokumen-ocr/<worker>/vllm`.
- General cache uses `XDG_CACHE_HOME=/workspace/dokumen-ocr/<worker>/cache`.
- Temporary files and transient image work use container disk under
  `/tmp/dokumen-ocr/<worker>`.
- Network volumes must not be attached or used.

Stopping or restarting a Pod preserves its volume disk. Terminating/deleting a
Pod deletes the volume disk and therefore deletes the downloaded model cache.

## Registry

The image registry is private AWS Elastic Container Registry.

Expected repositories:

- `dokumen-deepseek-ocr`
- `dokumen-olm-ocr2`

Image names look like:

```text
ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com/dokumen-deepseek-ocr:IMAGE_TAG
ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com/dokumen-olm-ocr2:IMAGE_TAG
```

Use immutable tags such as a Git SHA or `v0.1.0`. Do not deploy `latest`.

## ECR Auth For Runpod

AWS ECR Docker credentials are short-lived. The Docker username is always
`AWS`, and the password comes from:

```bash
aws ecr get-login-password --region "$AWS_REGION"
```

Runpod stores registry credentials as Docker-style username/password entries.
Because Runpod cannot assume your AWS IAM role directly, every deployment
refreshes a Runpod registry auth entry immediately before updating the Pods.

The scripts do this for you:

```bash
bash infra/runpod/sync-ecr-runpod-registry-auth.sh
```

If you manually start, restart, or reset a Pod after the ECR token has expired,
refresh auth first or use the wrapper:

```bash
bash infra/runpod/runpod-pod-action.sh restart all
```

## Local Ubuntu Setup

Install and authenticate the required CLIs on your Ubuntu desktop:

```bash
# Runpod CLI
mkdir -p ~/.local/bin
curl -sL https://github.com/runpod/runpodctl/releases/latest/download/runpodctl-linux-amd64.tar.gz \
  | tar xz -C ~/.local/bin
export PATH="$HOME/.local/bin:$PATH"
runpodctl doctor

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip
sudo ./aws/install
aws configure

# Utilities
sudo apt-get update
sudo apt-get install -y curl jq
```

After adding yourself to the `docker` group, log out and back in before running
Docker without `sudo`.

## Local Configuration

Create a local deploy config:

```bash
cp infra/runpod/.env.example infra/runpod/.env.local
```

Set these required values in `infra/runpod/.env.local`:

- `AWS_REGION`
- `IMAGE_TAG`
- `RUNPOD_API_KEY`
- `OCR_HTTP_BEARER_TOKEN`
- `DEEPSEEK_RUNPOD_POD_ID`
- `OLM_OCR2_RUNPOD_POD_ID`

`HF_TOKEN` is optional unless a model is gated or private.

Do not commit `infra/runpod/.env.local`.

## First Pod Bootstrap

The normal deploy path updates two fixed Pods. For the first deployment, either
create Pods manually in the Runpod console or let the deploy script create them.

To create them from the script, leave both Pod IDs blank and set:

```bash
CREATE_PODS=1
```

Then run:

```bash
bash infra/runpod/runpod-deploy-pods.sh
```

After creation, save the printed Pod IDs in:

- `infra/runpod/.env.local`
- GitHub Actions variables:
  - `DEEPSEEK_RUNPOD_POD_ID`
  - `OLM_OCR2_RUNPOD_POD_ID`

Subsequent deploys should use the fixed Pod IDs and `CREATE_PODS=0`.

## Local Deploy

From the repo root:

```bash
bash infra/runpod/runpod-deploy-pods.sh
```

The script:

1. Ensures the two ECR repositories exist.
2. Logs Docker in to ECR.
3. Builds both images for `linux/amd64`.
4. Pushes immutable ECR tags.
5. Creates a fresh Runpod registry auth entry with the current ECR token.
6. Updates the fixed Runpod Pods with the new image, env, ports, registry auth,
   container disk, and `/workspace` volume disk settings.
7. Writes local deployment state to `infra/runpod/local-state/runpod-state.json`.

That state file is local operator state and should not be committed.

## Smoke Test

Run:

```bash
bash infra/runpod/test-pods.sh
```

The smoke test:

- verifies neither Pod has a network volume attached
- polls `/ping` until ready
- verifies unauthenticated `/ocr` returns `401`
- posts an authenticated PNG to `/ocr`
- validates the normalized JSON response shape

You can also test one Pod manually:

```bash
curl "https://POD_ID-8000.proxy.runpod.net/ping"

curl -X POST "https://POD_ID-8000.proxy.runpod.net/ocr" \
  -H "Authorization: Bearer $OCR_HTTP_BEARER_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @page.png
```

## GitHub Actions CI/CD

Workflow:

```text
.github/workflows/deploy-gpu-pods.yml
```

Required GitHub Actions secrets:

- `AWS_GITHUB_DEPLOY_ROLE_ARN`
- `RUNPOD_API_KEY`
- `OCR_HTTP_BEARER_TOKEN`
- `HF_TOKEN` if needed for gated/private models

Required GitHub Actions variables:

- `AWS_REGION`
- `GPU_DEEPSEEK_ECR_REPOSITORY`
- `GPU_OLM_OCR2_ECR_REPOSITORY`
- `DEEPSEEK_RUNPOD_POD_ID`
- `OLM_OCR2_RUNPOD_POD_ID`

Optional variables:

- `RUNPOD_GPU_TYPE`
- `RUNPOD_GPU_COUNT`
- `RUNPOD_CLOUD_TYPE`
- `RUNPOD_DATA_CENTER_IDS`
- `GPU_CONTAINER_DISK_GB`
- `GPU_VOLUME_GB`

The workflow assumes the existing AWS GitHub OIDC deploy role. That role must
have ECR push permissions for both GPU repositories.

## Production Secrets

The API and workers call the Pod proxy URLs directly. Store these values in the
reviewed `prod/runpod` secret draft:

```json
{
  "OCR_MODEL": "deepseek-ocr",
  "DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL": "https://DEEPSEEK_POD_ID-8000.proxy.runpod.net/ocr",
  "OLM_OCR2_RUNPOD_ENDPOINT_URL": "https://OLM_POD_ID-8000.proxy.runpod.net/ocr",
  "OCR_RUNPOD_HTTP_TOKEN": "same-token-as-OCR_HTTP_BEARER_TOKEN",
  "OCR_RUNPOD_TIMEOUT_SECONDS": 60,
  "OCR_RUNPOD_RETRIES": 0
}
```

Do not put the Runpod account API key in app runtime secrets. It is only needed
by deployment and operator scripts.

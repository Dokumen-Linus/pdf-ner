# Runpod Deployment Helpers

This directory contains local operator scripts for deploying the two fixed
Runpod OCR Pods used by Dokumen AI:

- `deepseek-ocr`
- `olm-ocr2`

The source-of-truth worker service contract lives in `gpu/README.AGENTS.md`.
Read that file before changing the GPU workers.

## What To Run

Create local Runpod deploy inputs:

```bash
cp infra/runpod/.env.example infra/runpod/.env.local
```

Edit `infra/runpod/.env.local`. For the first Pod creation, set:

```env
AWS_REGION=us-east-1
IMAGE_TAG=<immutable-tag-not-latest>
RUNPOD_API_KEY=<runpod-api-key>
OCR_HTTP_BEARER_TOKEN=<new-runtime-token>
HF_TOKEN=<optional-if-needed>
DEEPSEEK_RUNPOD_POD_ID=
OLM_OCR2_RUNPOD_POD_ID=
CREATE_PODS=1
```

Then run:

```bash
bash infra/runpod/deploy_all.sh
```

After the first successful run, save the printed Pod IDs in
`infra/runpod/.env.local` and change `CREATE_PODS=0`. Future runs should update
the same fixed Pods instead of creating replacements.

## Script Flow

`deploy_all.sh` is the main local entrypoint. It:

1. Loads `infra/runpod/.env.local`.
2. Runs `preflight-first-pods.sh`.
3. Runs `deploy-first-pods.sh`.
4. Runs `test-pods.sh`.
5. Prints the local state and secret draft paths.

`preflight-first-pods.sh` checks local readiness without refreshing AWS login:

- required commands: `aws`, `curl`, `docker`, `jq`, and `runpodctl`
- required settings: `AWS_REGION`, `IMAGE_TAG`, `RUNPOD_API_KEY`, and
  `OCR_HTTP_BEARER_TOKEN`
- `IMAGE_TAG` is not `latest`
- first bootstrap has both Pod IDs blank and `CREATE_PODS=1`
- fixed deploys have both Pod IDs set and `CREATE_PODS=0`
- mixed Pod ID state is rejected
- current AWS credentials can call STS
- Docker is usable by the current user
- `runpodctl` can authenticate with `RUNPOD_API_KEY`

`deploy-first-pods.sh` wraps `runpod-deploy-pods.sh`. It builds and pushes the
GPU images, refreshes Runpod registry auth for ECR, updates the two fixed Pods,
reads endpoint URLs from local state, and patches `infra/init/local-secrets/prod-runpod.json`
if that draft exists.

`test-pods.sh` verifies both Pods after deploy. It checks that no network volume
is attached, waits for `/ping`, verifies unauthenticated `/ocr` returns `401`,
posts an authenticated smoke PNG to `/ocr`, and validates the normalized JSON
shape.

## Local Ubuntu Setup

Install and authenticate the required CLIs on an Ubuntu desktop:

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

## Manual Pod Creation

The normal path is to let `deploy_all.sh` create or update the fixed Pods. If
Runpod API Pod creation fails but the console works, create the Pods manually
and then save the Pod IDs in `infra/runpod/.env.local`.

Use one Pod per worker image:

- `ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com/dokumen-deepseek-ocr:IMAGE_TAG`
- `ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com/dokumen-olm-ocr2:IMAGE_TAG`

Manual Pod settings:

- Billing: on-demand / pay-as-you-go
- GPU: one GPU; RTX 3090 is acceptable for low-traffic bootstrap if the model
  fits, while RTX 4090 or RTX 5090 are preferred when available
- Cloud type: Secure Cloud when available
- Container disk: `80 GB`
- Storage: Pod volume disk, not network volume
- Volume disk: `120 GB`
- Volume mount path: `/workspace`
- Network volume: none
- Ports: `8000/http`
- Registry auth: select the fresh Runpod ECR registry auth created by
  `sync-ecr-runpod-registry-auth.sh`
- Encrypt volume: enabled
- SSH terminal access: enabled for bootstrap/debugging
- Start Jupyter notebook: disabled

Required environment variables on each Pod:

- `PORT=8000`
- `PORT_HEALTH=8000`
- `OCR_HTTP_BEARER_TOKEN=<runtime-token>`
- `HF_TOKEN=<optional-if-needed>`

After manual creation, set:

```env
DEEPSEEK_RUNPOD_POD_ID=<manual-deepseek-pod-id>
OLM_OCR2_RUNPOD_POD_ID=<manual-olm-pod-id>
CREATE_PODS=0
```

Then run the deploy or smoke-test scripts from this directory. Fixed deploys
should update those same Pod IDs instead of creating replacements.

## Files Written

The deployment scripts write local, gitignored operator state:

- `infra/runpod/local-state/runpod-state.json`

That state file stores Pod IDs and proxy URLs. It is used by later smoke tests
and by the secret-draft patching step.

If `infra/init/local-secrets/prod-runpod.json` exists, `deploy-first-pods.sh`
patches these runtime app secret values:

```json
{
  "OCR_MODEL": "deepseek-ocr",
  "DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL": "https://DEEPSEEK_POD_ID-8000.proxy.runpod.net/ocr",
  "OLM_OCR2_RUNPOD_ENDPOINT_URL": "https://OLM_POD_ID-8000.proxy.runpod.net/ocr",
  "OCR_RUNPOD_HTTP_TOKEN": "same-value-as-OCR_HTTP_BEARER_TOKEN",
  "OCR_RUNPOD_TIMEOUT_SECONDS": 60,
  "OCR_RUNPOD_RETRIES": 0
}
```

Do not put the Runpod account API key in AWS app runtime secrets. The API key is
only for deployment and operator scripts. The app runtime secret uses
`OCR_RUNPOD_HTTP_TOKEN`.

The API and workers call the Pod proxy URLs directly. Store only the Pod proxy
URLs and runtime bearer token in the reviewed `prod/runpod` secret draft.

## What Comes From gpu/README.AGENTS.md

Use `gpu/README.AGENTS.md` for the worker runtime contract and cache layout:

- both workers expose `GET /ping` and authenticated `POST /ocr` on port `8000`
- Pod proxy URLs use `https://<pod-id>-8000.proxy.runpod.net`
- model caches live under `/workspace/dokumen-ocr/<worker>/`
- network volumes must not be attached

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

## GitHub Actions Values

The deploy workflow assumes the existing AWS GitHub OIDC deploy role. That role
must have ECR push permissions for both GPU repositories.

After first Pod creation, save these variables for CI deploys:

```bash
gh variable set GPU_DEEPSEEK_ECR_REPOSITORY --body "dokumen-deepseek-ocr"
gh variable set GPU_OLM_OCR2_ECR_REPOSITORY --body "dokumen-olm-ocr2"
gh variable set DEEPSEEK_RUNPOD_POD_ID --body "<fixed-deepseek-pod-id>"
gh variable set OLM_OCR2_RUNPOD_POD_ID --body "<fixed-olm-pod-id>"
```

The deploy workflow also needs `RUNPOD_API_KEY`, `OCR_HTTP_BEARER_TOKEN`, and
optional `HF_TOKEN` as GitHub Actions secrets.

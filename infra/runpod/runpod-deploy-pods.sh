#!/usr/bin/env bash
# Build GPU OCR images, push to AWS ECR, refresh Runpod ECR auth, and update fixed Pods.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GPU_DIR="${REPO_ROOT}/gpu"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_DIR="${STATE_DIR:-${SCRIPT_DIR}/local-state}"
STATE_FILE="${STATE_FILE:-${STATE_DIR}/runpod-state.json}"
RUNPOD_REST_URL="${RUNPOD_REST_URL:-https://rest.runpod.io/v1}"

if [ -f "$LOCAL_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$LOCAL_ENV_FILE"
  set +a
fi

PROJECT_NAME="${PROJECT_NAME:-dokumen}"
AWS_REGION="${AWS_REGION:-us-east-1}"
IMAGE_TAG="${IMAGE_TAG:-}"
ECR_UNTAGGED_IMAGE_RETENTION_DAYS="${ECR_UNTAGGED_IMAGE_RETENTION_DAYS:-14}"
DEEPSEEK_ECR_REPOSITORY="${DEEPSEEK_ECR_REPOSITORY:-${PROJECT_NAME}-deepseek-ocr}"
OLM_OCR2_ECR_REPOSITORY="${OLM_OCR2_ECR_REPOSITORY:-${PROJECT_NAME}-olm-ocr2}"
RUNPOD_GPU_TYPE="${RUNPOD_GPU_TYPE:-NVIDIA GeForce RTX 5090}"
RUNPOD_GPU_COUNT="${RUNPOD_GPU_COUNT:-1}"
RUNPOD_CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-SECURE}"
RUNPOD_DATA_CENTER_IDS="${RUNPOD_DATA_CENTER_IDS:-}"
CONTAINER_DISK_GB="${CONTAINER_DISK_GB:-80}"
VOLUME_GB="${VOLUME_GB:-120}"
VOLUME_MOUNT_PATH="${VOLUME_MOUNT_PATH:-/workspace}"
PORT="${PORT:-8000}"
PORT_HEALTH="${PORT_HEALTH:-$PORT}"
CREATE_PODS="${CREATE_PODS:-0}"
HF_TOKEN="${HF_TOKEN:-}"
OCR_HTTP_BEARER_TOKEN="${OCR_HTTP_BEARER_TOKEN:-}"
RUNPOD_API_KEY="${RUNPOD_API_KEY:-}"

DEEPSEEK_RUNPOD_POD_ID="${DEEPSEEK_RUNPOD_POD_ID:-}"
OLM_OCR2_RUNPOD_POD_ID="${OLM_OCR2_RUNPOD_POD_ID:-}"

DEEPSEEK_MODEL_NAME="${DEEPSEEK_MODEL_NAME:-deepseek-ai/DeepSeek-OCR}"
DEEPSEEK_OCR_PROMPT="${DEEPSEEK_OCR_PROMPT:-$'<image>\nFree OCR.'}"
DEEPSEEK_MAX_TOKENS="${DEEPSEEK_MAX_TOKENS:-2048}"
DEEPSEEK_TEMPERATURE="${DEEPSEEK_TEMPERATURE:-0.0}"
DEEPSEEK_NGRAM_SIZE="${DEEPSEEK_NGRAM_SIZE:-30}"
DEEPSEEK_NGRAM_WINDOW_SIZE="${DEEPSEEK_NGRAM_WINDOW_SIZE:-90}"

OLM_OCR2_MODEL_NAME="${OLM_OCR2_MODEL_NAME:-allenai/olmOCR-2-7B-1025-FP8}"
OLM_OCR2_PROCESSOR_NAME="${OLM_OCR2_PROCESSOR_NAME:-Qwen/Qwen2.5-VL-7B-Instruct}"
OLM_OCR2_MAX_NEW_TOKENS="${OLM_OCR2_MAX_NEW_TOKENS:-8000}"
OLM_OCR2_TEMPERATURE="${OLM_OCR2_TEMPERATURE:-0.1}"
OLM_OCR2_TARGET_LONGEST_IMAGE_DIM="${OLM_OCR2_TARGET_LONGEST_IMAGE_DIM:-1288}"
OLM_OCR2_GPU_MEMORY_UTILIZATION="${OLM_OCR2_GPU_MEMORY_UTILIZATION:-0.9}"
OLM_OCR2_MAX_MODEL_LEN="${OLM_OCR2_MAX_MODEL_LEN:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ] || [ "${!name}" = "REPLACE_ME" ]; then
    echo "ERROR: required environment variable is not set: $name" >&2
    echo "Set it in $LOCAL_ENV_FILE, export it, or configure it in GitHub Actions." >&2
    exit 1
  fi
}

ecr_lifecycle_policy_json() {
  jq -cn --argjson days "$ECR_UNTAGGED_IMAGE_RETENTION_DAYS" '
    {
      rules: [
        {
          rulePriority: 1,
          description: "Expire untagged images after the configured retention window",
          selection: {
            tagStatus: "untagged",
            countType: "sinceImagePushed",
            countUnit: "days",
            countNumber: $days
          },
          action: { type: "expire" }
        }
      ]
    }'
}

aws_region() {
  aws --region "$AWS_REGION" "$@"
}

state_get() {
  local jq_filter="$1"
  if [ -f "$STATE_FILE" ]; then
    jq -r "${jq_filter} // empty" "$STATE_FILE"
  fi
}

state_set_worker() {
  local worker="$1"
  local pod_id="$2"
  local image="$3"
  local tmp
  mkdir -p "$STATE_DIR"
  if [ ! -f "$STATE_FILE" ]; then
    printf '{}\n' > "$STATE_FILE"
  fi
  tmp="${STATE_FILE}.tmp"
  jq \
    --arg worker "$worker" \
    --arg pod_id "$pod_id" \
    --arg image "$image" \
    --arg ocr_url "https://${pod_id}-${PORT}.proxy.runpod.net/ocr" \
    --arg ping_url "https://${pod_id}-${PORT}.proxy.runpod.net/ping" \
    '.[$worker] = {
      pod_id: $pod_id,
      image: $image,
      ocr_url: $ocr_url,
      ping_url: $ping_url
    }' "$STATE_FILE" > "$tmp"
  mv "$tmp" "$STATE_FILE"
}

api_request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"

  if [ -n "$payload" ]; then
    curl -fsS \
      --request "$method" \
      --url "${RUNPOD_REST_URL}${path}" \
      --header "Authorization: Bearer ${RUNPOD_API_KEY}" \
      --header "Content-Type: application/json" \
      --data "$payload"
  else
    curl -fsS \
      --request "$method" \
      --url "${RUNPOD_REST_URL}${path}" \
      --header "Authorization: Bearer ${RUNPOD_API_KEY}"
  fi
}

csv_to_json_array() {
  local csv="$1"
  jq -cn --arg csv "$csv" '$csv | split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0))'
}

ensure_ecr_repository() {
  local repository="$1"
  if aws_region ecr describe-repositories --repository-names "$repository" >/dev/null 2>&1; then
    :
  else
    aws_region ecr create-repository \
      --repository-name "$repository" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability IMMUTABLE \
      --encryption-configuration encryptionType=AES256 >/dev/null
  fi

  aws_region ecr put-image-scanning-configuration \
    --repository-name "$repository" \
    --image-scanning-configuration scanOnPush=true >/dev/null
  aws_region ecr put-image-tag-mutability \
    --repository-name "$repository" \
    --image-tag-mutability IMMUTABLE >/dev/null
  aws_region ecr put-lifecycle-policy \
    --repository-name "$repository" \
    --lifecycle-policy-text "$(ecr_lifecycle_policy_json)" >/dev/null
}

base_env_json() {
  jq -cn \
    --arg port "$PORT" \
    --arg port_health "$PORT_HEALTH" \
    --arg hf_token "$HF_TOKEN" \
    --arg ocr_token "$OCR_HTTP_BEARER_TOKEN" \
    '{
      PORT: $port,
      PORT_HEALTH: $port_health,
      OCR_HTTP_BEARER_TOKEN: $ocr_token,
      PYTHONUNBUFFERED: "1"
    }
    + (if $hf_token == "" then {} else {HF_TOKEN: $hf_token} end)'
}

deepseek_env_json() {
  local base
  base="$(base_env_json)"
  jq -cn \
    --argjson base "$base" \
    --arg model "$DEEPSEEK_MODEL_NAME" \
    --arg prompt "$DEEPSEEK_OCR_PROMPT" \
    --arg max_tokens "$DEEPSEEK_MAX_TOKENS" \
    --arg temperature "$DEEPSEEK_TEMPERATURE" \
    --arg ngram_size "$DEEPSEEK_NGRAM_SIZE" \
    --arg ngram_window_size "$DEEPSEEK_NGRAM_WINDOW_SIZE" \
    '$base + {
      MODEL_NAME: $model,
      OCR_PROMPT: $prompt,
      MAX_TOKENS: $max_tokens,
      TEMPERATURE: $temperature,
      NGRAM_SIZE: $ngram_size,
      NGRAM_WINDOW_SIZE: $ngram_window_size
    }'
}

olm_ocr2_env_json() {
  local base
  base="$(base_env_json)"
  jq -cn \
    --argjson base "$base" \
    --arg model "$OLM_OCR2_MODEL_NAME" \
    --arg processor "$OLM_OCR2_PROCESSOR_NAME" \
    --arg max_new_tokens "$OLM_OCR2_MAX_NEW_TOKENS" \
    --arg temperature "$OLM_OCR2_TEMPERATURE" \
    --arg target_dim "$OLM_OCR2_TARGET_LONGEST_IMAGE_DIM" \
    --arg gpu_memory "$OLM_OCR2_GPU_MEMORY_UTILIZATION" \
    --arg max_model_len "$OLM_OCR2_MAX_MODEL_LEN" \
    '$base + {
      MODEL_NAME: $model,
      PROCESSOR_NAME: $processor,
      MAX_NEW_TOKENS: $max_new_tokens,
      TEMPERATURE: $temperature,
      TARGET_LONGEST_IMAGE_DIM: $target_dim,
      GPU_MEMORY_UTILIZATION: $gpu_memory
    }
    + (if $max_model_len == "" then {} else {MAX_MODEL_LEN: $max_model_len} end)'
}

pod_update_payload() {
  local name="$1"
  local image="$2"
  local env_json="$3"
  local registry_auth_id="$4"

  jq -cn \
    --arg name "$name" \
    --arg image "$image" \
    --arg port "${PORT}/http" \
    --arg volume_mount_path "$VOLUME_MOUNT_PATH" \
    --arg registry_auth_id "$registry_auth_id" \
    --argjson container_disk "$CONTAINER_DISK_GB" \
    --argjson volume "$VOLUME_GB" \
    --argjson env "$env_json" \
    '{
      name: $name,
      imageName: $image,
      containerDiskInGb: $container_disk,
      volumeInGb: $volume,
      volumeMountPath: $volume_mount_path,
      ports: [$port],
      env: $env,
      containerRegistryAuthId: $registry_auth_id
    }'
}

pod_create_payload() {
  local name="$1"
  local image="$2"
  local env_json="$3"
  local registry_auth_id="$4"
  local data_centers
  data_centers="$(csv_to_json_array "$RUNPOD_DATA_CENTER_IDS")"

  jq -cn \
    --arg name "$name" \
    --arg image "$image" \
    --arg gpu_type "$RUNPOD_GPU_TYPE" \
    --arg cloud_type "$RUNPOD_CLOUD_TYPE" \
    --arg port "${PORT}/http" \
    --arg volume_mount_path "$VOLUME_MOUNT_PATH" \
    --arg registry_auth_id "$registry_auth_id" \
    --argjson gpu_count "$RUNPOD_GPU_COUNT" \
    --argjson container_disk "$CONTAINER_DISK_GB" \
    --argjson volume "$VOLUME_GB" \
    --argjson env "$env_json" \
    --argjson data_centers "$data_centers" \
    '{
      name: $name,
      imageName: $image,
      computeType: "GPU",
      gpuTypeIds: [$gpu_type],
      gpuCount: $gpu_count,
      cloudType: $cloud_type,
      containerDiskInGb: $container_disk,
      volumeInGb: $volume,
      volumeMountPath: $volume_mount_path,
      ports: [$port],
      env: $env,
      containerRegistryAuthId: $registry_auth_id
    }
    + (if ($data_centers | length) == 0 then {} else {dataCenterIds: $data_centers} end)'
}

build_and_push_images() {
  echo "Ensuring ECR repositories..."
  ensure_ecr_repository "$DEEPSEEK_ECR_REPOSITORY"
  ensure_ecr_repository "$OLM_OCR2_ECR_REPOSITORY"

  if [ "${SKIP_DEEPSEEK_IMAGE:-0}" != "1" ] || [ "${SKIP_OLM_OCR2_IMAGE:-0}" != "1" ]; then
    echo "Logging Docker into ECR..."
    aws_region ecr get-login-password | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  fi

  if [ "${SKIP_DEEPSEEK_IMAGE:-0}" = "1" ]; then
    echo "Skipping DeepSeek OCR image build and push; reusing: $DEEPSEEK_IMAGE"
  else
    echo "Building and pushing DeepSeek OCR image..."
    docker build --platform linux/amd64 -f "${GPU_DIR}/deepseek-ocr/Dockerfile" -t "$DEEPSEEK_IMAGE" "$GPU_DIR"
    docker push "$DEEPSEEK_IMAGE"
  fi

  if [ "${SKIP_OLM_OCR2_IMAGE:-0}" = "1" ]; then
    echo "Skipping olmOCR2 image build and push; reusing: $OLM_OCR2_IMAGE"
  else
    echo "Building and pushing olmOCR2 image..."
    docker build --platform linux/amd64 -f "${GPU_DIR}/olm-ocr2/Dockerfile" -t "$OLM_OCR2_IMAGE" "$GPU_DIR"
    docker push "$OLM_OCR2_IMAGE"
  fi
}

refresh_registry_auth() {
  LOCAL_ENV_FILE="$LOCAL_ENV_FILE" \
    STATE_DIR="$STATE_DIR" \
    STATE_FILE="$STATE_FILE" \
    AWS_REGION="$AWS_REGION" \
    bash "${SCRIPT_DIR}/sync-ecr-runpod-registry-auth.sh"

  RUNPOD_CONTAINER_REGISTRY_AUTH_ID="$(state_get '.container_registry_auth_id')"
  if [ -z "$RUNPOD_CONTAINER_REGISTRY_AUTH_ID" ]; then
    echo "ERROR: missing Runpod container registry auth id after refresh." >&2
    exit 1
  fi
}

ensure_pod() {
  local worker="$1"
  local name="$2"
  local pod_id="$3"
  local image="$4"
  local env_json="$5"
  local payload response

  if [ -n "$pod_id" ]; then
    echo "Updating Runpod Pod for $worker: $pod_id" >&2
    payload="$(pod_update_payload "$name" "$image" "$env_json" "$RUNPOD_CONTAINER_REGISTRY_AUTH_ID")"
    response="$(api_request PATCH "/pods/${pod_id}" "$payload")"
    printf '%s' "$response" | jq -r '.id // .pod.id // empty'
    return 0
  fi

  if [ "$CREATE_PODS" != "1" ]; then
    echo "ERROR: missing ${worker} Pod ID. Set CREATE_PODS=1 to create it, or set the fixed Pod ID." >&2
    exit 1
  fi

  echo "Creating Runpod Pod for $worker..." >&2
  payload="$(pod_create_payload "$name" "$image" "$env_json" "$RUNPOD_CONTAINER_REGISTRY_AUTH_ID")"
  response="$(api_request POST "/pods" "$payload")"
  printf '%s' "$response" | jq -r '.id // .pod.id // empty'
}

deploy_worker() {
  local worker="$1"
  local pod_env_name="$2"
  local image="$3"
  local env_json="$4"
  local pod_id result_id

  pod_id="${!pod_env_name:-}"
  if [ -z "$pod_id" ]; then
    pod_id="$(state_get ".[\"${worker}\"].pod_id")"
  fi

  result_id="$(ensure_pod "$worker" "${PROJECT_NAME}-${worker}" "$pod_id" "$image" "$env_json")"
  if [ -z "$result_id" ]; then
    result_id="$pod_id"
  fi
  if [ -z "$result_id" ]; then
    echo "ERROR: Runpod did not return a Pod ID for $worker." >&2
    exit 1
  fi

  state_set_worker "$worker" "$result_id" "$image"
}

record_existing_worker() {
  local worker="$1"
  local pod_env_name="$2"
  local image="$3"
  local pod_id

  pod_id="${!pod_env_name:-}"
  if [ -z "$pod_id" ]; then
    pod_id="$(state_get ".[\"${worker}\"].pod_id")"
  fi
  if [ -z "$pod_id" ]; then
    echo "ERROR: SKIP_${worker//-/_}_POD=1 requires ${pod_env_name} or existing state for $worker." >&2
    exit 1
  fi

  echo "Skipping Runpod Pod create/update for $worker; recording existing Pod: $pod_id" >&2
  state_set_worker "$worker" "$pod_id" "$image"
}

print_summary() {
  cat <<EOF

=============================================
  RUNPOD OCR POD DEPLOY COMPLETE
=============================================

State:
  $STATE_FILE

Runtime secret values for prod/runpod:
  DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL=$(jq -r '.["deepseek-ocr"].ocr_url // empty' "$STATE_FILE")
  OLM_OCR2_RUNPOD_ENDPOINT_URL=$(jq -r '.["olm-ocr2"].ocr_url // empty' "$STATE_FILE")
  OCR_RUNPOD_HTTP_TOKEN=<same value deployed as OCR_HTTP_BEARER_TOKEN>

Smoke test:
  bash infra/runpod/test-pods.sh
EOF
}

main() {
  require_cmd aws
  require_cmd curl
  require_cmd jq
  require_cmd runpodctl
  if [ "${SKIP_DEEPSEEK_IMAGE:-0}" != "1" ] || [ "${SKIP_OLM_OCR2_IMAGE:-0}" != "1" ]; then
    require_cmd docker
  fi
  require_env IMAGE_TAG
  require_env RUNPOD_API_KEY
  require_env OCR_HTTP_BEARER_TOKEN

  if [ "$IMAGE_TAG" = "latest" ]; then
    echo "ERROR: IMAGE_TAG must be immutable; do not use latest." >&2
    exit 1
  fi
  if [ "$VOLUME_MOUNT_PATH" != "/workspace" ]; then
    echo "ERROR: VOLUME_MOUNT_PATH must remain /workspace for Runpod Pod volume disk caches." >&2
    exit 1
  fi
  if [ -n "${RUNPOD_NETWORK_VOLUME_ID:-}" ] || [ -n "${NETWORK_VOLUME_ID:-}" ]; then
    echo "ERROR: network volumes are not allowed for GPU OCR Pods." >&2
    exit 1
  fi

  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  DEEPSEEK_IMAGE="${DEEPSEEK_IMAGE:-${ECR_REGISTRY}/${DEEPSEEK_ECR_REPOSITORY}:${IMAGE_TAG}}"
  OLM_OCR2_IMAGE="${OLM_OCR2_IMAGE:-${ECR_REGISTRY}/${OLM_OCR2_ECR_REPOSITORY}:${IMAGE_TAG}}"

  mkdir -p "$STATE_DIR"
  if [ ! -f "$STATE_FILE" ]; then
    printf '{}\n' > "$STATE_FILE"
  fi

  build_and_push_images
  refresh_registry_auth
  if [ "${SKIP_DEEPSEEK_POD:-0}" = "1" ]; then
    record_existing_worker "deepseek-ocr" "DEEPSEEK_RUNPOD_POD_ID" "$DEEPSEEK_IMAGE"
  else
    deploy_worker "deepseek-ocr" "DEEPSEEK_RUNPOD_POD_ID" "$DEEPSEEK_IMAGE" "$(deepseek_env_json)"
  fi
  deploy_worker "olm-ocr2" "OLM_OCR2_RUNPOD_POD_ID" "$OLM_OCR2_IMAGE" "$(olm_ocr2_env_json)"
  print_summary
}

main "$@"

#!/usr/bin/env bash
# Build and deploy Dokumen OCR GPU workers to Runpod Serverless.
#
# Run this from a Linux machine. It builds linux/amd64 Docker images from
# gpu/ so gpu/shared is copied into both worker images.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GPU_DIR="${REPO_ROOT}/gpu"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${SCRIPT_DIR}/.env.local}"
STATE_DIR="${STATE_DIR:-${SCRIPT_DIR}/local-state}"
STATE_FILE="${STATE_FILE:-${STATE_DIR}/runpod-state.json}"
RUNPOD_REST_URL="${RUNPOD_REST_URL:-https://rest.runpod.io/v1}"

load_local_env() {
  if [ -f "$LOCAL_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$LOCAL_ENV_FILE"
    set +a
  fi
}

configure_defaults() {
  PROJECT_NAME="${PROJECT_NAME:-dokumen}"
  IMAGE_TAG="${IMAGE_TAG:-}"
  DOCKERHUB_NAMESPACE="${DOCKERHUB_NAMESPACE:-}"
  RUNPOD_GPU_TYPE="${RUNPOD_GPU_TYPE:-NVIDIA GeForce RTX 5090}"
  RUNPOD_GPU_COUNT="${RUNPOD_GPU_COUNT:-1}"
  RUNPOD_MIN_CUDA_VERSION="${RUNPOD_MIN_CUDA_VERSION:-12.8}"
  RUNPOD_ALLOWED_CUDA_VERSIONS="${RUNPOD_ALLOWED_CUDA_VERSIONS:-12.8,12.9,13.0}"
  RUNPOD_DATA_CENTER_IDS="${RUNPOD_DATA_CENTER_IDS:-}"
  WORKERS_MIN="${WORKERS_MIN:-0}"
  WORKERS_MAX="${WORKERS_MAX:-1}"
  IDLE_TIMEOUT="${IDLE_TIMEOUT:-30}"
  SCALER_TYPE="${SCALER_TYPE:-QUEUE_DELAY}"
  SCALER_VALUE="${SCALER_VALUE:-4}"
  EXECUTION_TIMEOUT_MS="${EXECUTION_TIMEOUT_MS:-330000}"
  CONTAINER_DISK_GB="${CONTAINER_DISK_GB:-80}"
  RUNPOD_CONTAINER_REGISTRY_AUTH_ID="${RUNPOD_CONTAINER_REGISTRY_AUTH_ID:-}"
  PORT="${PORT:-8000}"
  PORT_HEALTH="${PORT_HEALTH:-$PORT}"
  RUNPOD_CREATE_ENDPOINTS="${RUNPOD_CREATE_ENDPOINTS:-1}"
  FORCE_RECREATE="${FORCE_RECREATE:-0}"

  DEEPSEEK_IMAGE="${DEEPSEEK_IMAGE:-${DOCKERHUB_NAMESPACE}/dokumen-deepseek-ocr:${IMAGE_TAG}}"
  OLM_OCR2_IMAGE="${OLM_OCR2_IMAGE:-${DOCKERHUB_NAMESPACE}/dokumen-olm-ocr2:${IMAGE_TAG}}"

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
  HF_TOKEN="${HF_TOKEN:-}"
}

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
    echo "Set it in $LOCAL_ENV_FILE or export it before running this script." >&2
    exit 1
  fi
}

check_prerequisites() {
  require_cmd curl
  require_cmd docker
  require_cmd jq
  require_cmd runpodctl
  require_env DOCKERHUB_NAMESPACE
  require_env IMAGE_TAG
  require_env RUNPOD_API_KEY

  if [ "$IMAGE_TAG" = "latest" ]; then
    echo "ERROR: IMAGE_TAG must be an explicit immutable tag, not latest." >&2
    exit 1
  fi

  if [ "$(uname -s)" != "Linux" ]; then
    echo "ERROR: runpod-setup.sh is intended for Linux deployment machines." >&2
    exit 1
  fi

  mkdir -p "$STATE_DIR"
  if [ ! -f "$STATE_FILE" ]; then
    printf '{}\n' > "$STATE_FILE"
  fi
}

print_banner() {
  cat <<EOF
=============================================
  Dokumen OCR - Runpod setup
=============================================
Project:       $PROJECT_NAME
GPU:           $RUNPOD_GPU_TYPE
CUDA:          >=$RUNPOD_MIN_CUDA_VERSION ($RUNPOD_ALLOWED_CUDA_VERSIONS)
DeepSeek image: $DEEPSEEK_IMAGE
olmOCR2 image: $OLM_OCR2_IMAGE
State file:    $STATE_FILE
=============================================

EOF
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

state_get() {
  local jq_filter="$1"
  jq -r "${jq_filter} // empty" "$STATE_FILE"
}

state_set_worker() {
  local worker="$1"
  local template_id="$2"
  local endpoint_id="$3"
  local image="$4"
  local tmp
  tmp="${STATE_FILE}.tmp"
  jq \
    --arg worker "$worker" \
    --arg template_id "$template_id" \
    --arg endpoint_id "$endpoint_id" \
    --arg image "$image" \
    --arg direct_url "https://${endpoint_id}.api.runpod.ai/ocr" \
    --arg ping_url "https://${endpoint_id}.api.runpod.ai/ping" \
    '.[$worker] = {
      template_id: $template_id,
      endpoint_id: $endpoint_id,
      image: $image,
      ocr_url: $direct_url,
      ping_url: $ping_url
    }' "$STATE_FILE" > "$tmp"
  mv "$tmp" "$STATE_FILE"
}

build_and_push_images() {
  echo "Building and pushing DeepSeek OCR image..."
  docker build --platform linux/amd64 -f "${GPU_DIR}/deepseek-ocr/Dockerfile" -t "$DEEPSEEK_IMAGE" "$GPU_DIR"
  docker push "$DEEPSEEK_IMAGE"

  echo "Building and pushing olmOCR2 image..."
  docker build --platform linux/amd64 -f "${GPU_DIR}/olm-ocr2/Dockerfile" -t "$OLM_OCR2_IMAGE" "$GPU_DIR"
  docker push "$OLM_OCR2_IMAGE"
}

template_payload() {
  local name="$1"
  local image="$2"
  local env_json="$3"

  jq -cn \
    --arg name "$name" \
    --arg image "$image" \
    --arg port "${PORT}/http" \
    --argjson disk "$CONTAINER_DISK_GB" \
    --argjson env "$env_json" \
    --arg registry_auth "$RUNPOD_CONTAINER_REGISTRY_AUTH_ID" \
    '{
      name: $name,
      imageName: $image,
      category: "NVIDIA",
      isPublic: false,
      isServerless: true,
      containerDiskInGb: $disk,
      ports: [$port],
      env: $env,
      dockerEntrypoint: ["python"],
      dockerStartCmd: ["app.py"],
      readme: "Dokumen OCR load-balancing Serverless worker."
    }
    + (if $registry_auth == "" then {} else {containerRegistryAuthId: $registry_auth} end)'
}

endpoint_payload() {
  local name="$1"
  local template_id="$2"
  local cuda_versions data_centers
  cuda_versions="$(csv_to_json_array "$RUNPOD_ALLOWED_CUDA_VERSIONS")"
  data_centers="$(csv_to_json_array "$RUNPOD_DATA_CENTER_IDS")"

  jq -cn \
    --arg name "$name" \
    --arg template_id "$template_id" \
    --arg gpu_type "$RUNPOD_GPU_TYPE" \
    --arg min_cuda "$RUNPOD_MIN_CUDA_VERSION" \
    --arg scaler_type "$SCALER_TYPE" \
    --argjson gpu_count "$RUNPOD_GPU_COUNT" \
    --argjson workers_min "$WORKERS_MIN" \
    --argjson workers_max "$WORKERS_MAX" \
    --argjson idle_timeout "$IDLE_TIMEOUT" \
    --argjson scaler_value "$SCALER_VALUE" \
    --argjson execution_timeout "$EXECUTION_TIMEOUT_MS" \
    --argjson cuda_versions "$cuda_versions" \
    --argjson data_centers "$data_centers" \
    '{
      name: $name,
      templateId: $template_id,
      computeType: "GPU",
      gpuTypeIds: [$gpu_type],
      gpuCount: $gpu_count,
      workersMin: $workers_min,
      workersMax: $workers_max,
      idleTimeout: $idle_timeout,
      scalerType: $scaler_type,
      scalerValue: $scaler_value,
      executionTimeoutMs: $execution_timeout,
      minCudaVersion: $min_cuda,
      allowedCudaVersions: $cuda_versions
    }
    + (if ($data_centers | length) == 0 then {} else {dataCenterIds: $data_centers} end)'
}

base_env_json() {
  jq -cn \
    --arg port "$PORT" \
    --arg port_health "$PORT_HEALTH" \
    --arg hf_token "$HF_TOKEN" \
    '{
      PORT: $port,
      PORT_HEALTH: $port_health,
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

ensure_template() {
  local worker="$1"
  local name="$2"
  local image="$3"
  local env_json="$4"
  local template_id payload response
  template_id="$(state_get ".[\"${worker}\"].template_id")"
  payload="$(template_payload "$name" "$image" "$env_json")"

  if [ "$FORCE_RECREATE" = "0" ] && [ -n "$template_id" ] && api_request GET "/templates/${template_id}" >/dev/null 2>&1; then
    echo "Updating Runpod template for $worker: $template_id" >&2
    response="$(api_request PATCH "/templates/${template_id}" "$payload")"
  else
    echo "Creating Runpod template for $worker..." >&2
    response="$(api_request POST "/templates" "$payload")"
  fi

  printf '%s' "$response" | jq -r '.id'
}

ensure_endpoint() {
  local worker="$1"
  local name="$2"
  local template_id="$3"
  local endpoint_id payload response
  endpoint_id="$(state_get ".[\"${worker}\"].endpoint_id")"
  payload="$(endpoint_payload "$name" "$template_id")"

  if [ "$RUNPOD_CREATE_ENDPOINTS" != "1" ]; then
    echo "Skipping endpoint create/update for $worker because RUNPOD_CREATE_ENDPOINTS=$RUNPOD_CREATE_ENDPOINTS." >&2
    printf ''
    return 0
  fi

  if [ "$FORCE_RECREATE" = "0" ] && [ -n "$endpoint_id" ] && api_request GET "/endpoints/${endpoint_id}" >/dev/null 2>&1; then
    echo "Updating Runpod endpoint for $worker: $endpoint_id" >&2
    response="$(api_request PATCH "/endpoints/${endpoint_id}" "$payload")"
  else
    echo "Creating Runpod endpoint for $worker..." >&2
    response="$(api_request POST "/endpoints" "$payload")"
  fi

  printf '%s' "$response" | jq -r '.id'
}

deploy_worker() {
  local worker="$1"
  local image="$2"
  local env_json="$3"
  local template_name endpoint_name template_id endpoint_id
  template_name="${PROJECT_NAME}-${worker}-${IMAGE_TAG}"
  endpoint_name="${PROJECT_NAME}-${worker}"

  template_id="$(ensure_template "$worker" "$template_name" "$image" "$env_json")"
  endpoint_id="$(ensure_endpoint "$worker" "$endpoint_name" "$template_id")"

  if [ -n "$endpoint_id" ]; then
    state_set_worker "$worker" "$template_id" "$endpoint_id" "$image"
  else
    echo "Template for $worker: $template_id"
  fi
}

print_summary() {
  cat <<EOF

=============================================
  RUNPOD OCR SETUP COMPLETE
=============================================

State:
  $STATE_FILE

EOF

  if jq -e '.["deepseek-ocr"].endpoint_id and .["olm-ocr2"].endpoint_id' "$STATE_FILE" >/dev/null; then
    cat <<EOF
Runpod OCR endpoint values for prod/runpod:
  DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL=$(jq -r '.["deepseek-ocr"].ocr_url' "$STATE_FILE")
  OLM_OCR2_RUNPOD_ENDPOINT_URL=$(jq -r '.["olm-ocr2"].ocr_url' "$STATE_FILE")

Test deployed endpoints:
  bash infra/runpod/test-endpoints.sh

EOF
  else
    cat <<EOF
Endpoint creation was skipped. Create two Load Balancer Serverless endpoints in
the Runpod console from these templates, then run:
  DEEPSEEK_ENDPOINT_ID=<id> OLM_OCR2_ENDPOINT_ID=<id> bash infra/runpod/test-endpoints.sh

EOF
  fi
}

main() {
  load_local_env
  configure_defaults
  check_prerequisites
  print_banner
  build_and_push_images
  deploy_worker "deepseek-ocr" "$DEEPSEEK_IMAGE" "$(deepseek_env_json)"
  deploy_worker "olm-ocr2" "$OLM_OCR2_IMAGE" "$(olm_ocr2_env_json)"
  print_summary
}

main "$@"

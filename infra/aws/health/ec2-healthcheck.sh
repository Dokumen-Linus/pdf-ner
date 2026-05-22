#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-infra/.env.prod}"
LOG_LINES="${LOG_LINES:-120}"
MAX_RESTARTS="${MAX_RESTARTS:-}"
REQUIRED_SERVICES_TEXT="${REQUIRED_SERVICES:-nginx-proxy-manager redis api worker}"
OPTIONAL_SERVICES_TEXT="${OPTIONAL_SERVICES:-web}"
HOST_PORT_CHECKS_TEXT="${HOST_PORT_CHECKS:-nginx-proxy-manager:127.0.0.1:80 nginx-proxy-manager:127.0.0.1:81 nginx-proxy-manager:127.0.0.1:443 api:127.0.0.1:8000}"
CHECK_AWS_SECRETS="${CHECK_AWS_SECRETS:-0}"
CHECK_SECRET_UNPACK="${CHECK_SECRET_UNPACK:-0}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_SECRET_NAMES_TEXT="${AWS_SECRET_NAMES:-prod/web prod/email prod/api prod/workers prod/runpod}"
read -r -a REQUIRED_SERVICES <<< "$REQUIRED_SERVICES_TEXT"
read -r -a OPTIONAL_SERVICES <<< "$OPTIONAL_SERVICES_TEXT"
read -r -a HOST_PORT_CHECKS <<< "$HOST_PORT_CHECKS_TEXT"
read -r -a AWS_SECRET_NAMES <<< "$AWS_SECRET_NAMES_TEXT"
FAILURES=()

cd "$APP_DIR"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

service_container_id() {
  local service="$1"
  compose ps -q "$service" | head -n 1
}

container_field() {
  local container_id="$1"
  local template="$2"
  docker inspect --format "$template" "$container_id"
}

service_health() {
  local container_id="$1"
  container_field "$container_id" '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'
}

service_status() {
  local container_id="$1"
  container_field "$container_id" '{{.State.Status}}'
}

service_restart_count() {
  local container_id="$1"
  container_field "$container_id" '{{.RestartCount}}'
}

service_image() {
  local container_id="$1"
  container_field "$container_id" '{{.Config.Image}}'
}

service_ports() {
  local container_id="$1"
  docker port "$container_id" 2>/dev/null | tr '\n' ',' | sed 's/,$//'
}

container_env_value() {
  local container_id="$1"
  local name="$2"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id" \
    | awk -F= -v key="$name" '$1 == key { print substr($0, length(key) + 2); exit }'
}

record_failure() {
  FAILURES+=("$*")
}

print_service_summary() {
  local service="$1"
  local container_id
  container_id="$(service_container_id "$service")"

  if [[ -z "$container_id" ]]; then
    printf '%-22s %-12s %-12s %-8s %-28s %s\n' "$service" "missing" "-" "-" "-" "-"
    return
  fi

  printf '%-22s %-12s %-12s %-8s %-28s %s\n' \
    "$service" \
    "$(service_status "$container_id")" \
    "$(service_health "$container_id")" \
    "$(service_restart_count "$container_id")" \
    "$(service_image "$container_id")" \
    "$(service_ports "$container_id")"
}

print_recent_logs() {
  local service="$1"
  local container_id
  container_id="$(service_container_id "$service")"

  if [[ -z "$container_id" ]]; then
    echo "---- ${service}: no container ----"
    return
  fi

  echo "---- ${service}: last ${LOG_LINES} log lines ----"
  compose logs --no-color --tail "$LOG_LINES" "$service" || true
}

print_failure_context() {
  echo
  echo "Compose services at failure:"
  compose ps || true

  echo
  echo "Recent logs at failure:"
  local service
  for service in "${REQUIRED_SERVICES[@]}"; do
    print_recent_logs "$service"
  done
  for service in "${OPTIONAL_SERVICES[@]}"; do
    print_recent_logs "$service"
  done
}

check_compose_services() {
  echo "Compose services:"
  compose ps

  echo
  echo "Service status:"
  printf '%-22s %-12s %-12s %-8s %-28s %s\n' "SERVICE" "STATUS" "HEALTH" "RESTARTS" "IMAGE" "PORTS"
  local service
  for service in "${REQUIRED_SERVICES[@]}"; do
    print_service_summary "$service"
  done
  for service in "${OPTIONAL_SERVICES[@]}"; do
    print_service_summary "$service"
  done

  echo
  for service in "${REQUIRED_SERVICES[@]}"; do
    local container_id
    container_id="$(service_container_id "$service")"
    if [[ -z "$container_id" ]]; then
      record_failure "compose service '${service}' has no container"
      continue
    fi

    local status
    status="$(service_status "$container_id")"
    if [[ "$status" != "running" ]]; then
      record_failure "compose service '${service}' is ${status}, expected running"
    fi

    local health
    health="$(service_health "$container_id")"
    if [[ "$health" == "unhealthy" ]]; then
      record_failure "compose service '${service}' health is unhealthy"
    fi

    local restarts
    restarts="$(service_restart_count "$container_id")"
    if [[ -n "$MAX_RESTARTS" ]]; then
      (( restarts <= MAX_RESTARTS )) || record_failure "compose service '${service}' has restarted ${restarts} time(s), max allowed is ${MAX_RESTARTS}"
    fi
  done

  for service in "${OPTIONAL_SERVICES[@]}"; do
    local container_id
    container_id="$(service_container_id "$service")"
    if [[ -z "$container_id" ]]; then
      echo "optional compose service '${service}' has no container"
      continue
    fi

    local status
    status="$(service_status "$container_id")"
    if [[ "$status" != "running" ]]; then
      echo "optional compose service '${service}' is ${status}"
    fi

    local health
    health="$(service_health "$container_id")"
    if [[ "$health" == "unhealthy" ]]; then
      echo "optional compose service '${service}' health is unhealthy"
    fi
  done
}

check_tcp_port() {
  local host="$1"
  local port="$2"
  timeout 3 bash -c ":</dev/tcp/${host}/${port}" >/dev/null 2>&1
}

check_host_ports() {
  echo
  echo "Host port checks:"
  printf '%-22s %-16s %-8s %s\n' "SERVICE" "HOST" "PORT" "RESULT"

  local check
  for check in "${HOST_PORT_CHECKS[@]}"; do
    local service="${check%%:*}"
    local rest="${check#*:}"
    local host="${rest%:*}"
    local port="${rest##*:}"

    if check_tcp_port "$host" "$port"; then
      printf '%-22s %-16s %-8s %s\n' "$service" "$host" "$port" "open"
    else
      printf '%-22s %-16s %-8s %s\n' "$service" "$host" "$port" "closed"
      record_failure "host port ${host}:${port} for '${service}' is not reachable"
    fi
  done
}

check_bootstrap_env() {
  echo
  echo "Bootstrap env checks:"
  printf '%-22s %-16s %-12s %-12s %-12s %s\n' "SERVICE" "ENV" "APP_VERSION" "SECRETS" "REGION" "RESULT"

  local service
  for service in api worker web; do
    local container_id required result env_value app_version secrets_stage region
    container_id="$(service_container_id "$service")"
    required=0
    result="ok"
    for required_service in "${REQUIRED_SERVICES[@]}"; do
      if [[ "$required_service" == "$service" ]]; then
        required=1
        break
      fi
    done

    if [[ -z "$container_id" ]]; then
      result="missing"
      printf '%-22s %-16s %-12s %-12s %-12s %s\n' "$service" "-" "-" "-" "-" "$result"
      if [[ "$required" = "1" ]]; then
        record_failure "bootstrap env for required service '${service}' could not be checked because the container is missing"
      fi
      continue
    fi

    env_value="$(container_env_value "$container_id" ENV)"
    app_version="$(container_env_value "$container_id" APP_VERSION)"
    secrets_stage="$(container_env_value "$container_id" SECRETS_STAGE)"
    region="$(container_env_value "$container_id" AWS_REGION)"

    if [[ -z "$env_value" || -z "$app_version" || -z "$secrets_stage" || -z "$region" ]]; then
      result="empty-bootstrap"
      if [[ "$required" = "1" ]]; then
        record_failure "bootstrap env for required service '${service}' has empty ENV, APP_VERSION, SECRETS_STAGE, or AWS_REGION"
      fi
    fi

    printf '%-22s %-16s %-12s %-12s %-12s %s\n' "$service" "${env_value:-<empty>}" "${app_version:-<empty>}" "${secrets_stage:-<empty>}" "${region:-<empty>}" "$result"
  done
}

check_aws_secrets() {
  if [[ "$CHECK_AWS_SECRETS" != "1" ]]; then
    return
  fi

  echo
  echo "AWS Secrets Manager metadata checks:"
  printf '%-22s %-14s %s\n' "SECRET" "REGION" "RESULT"

  local secret_name
  for secret_name in "${AWS_SECRET_NAMES[@]}"; do
    if aws --region "$AWS_REGION" secretsmanager describe-secret --secret-id "$secret_name" >/dev/null 2>&1; then
      printf '%-22s %-14s %s\n' "$secret_name" "$AWS_REGION" "exists"
    else
      printf '%-22s %-14s %s\n' "$secret_name" "$AWS_REGION" "missing-or-inaccessible"
      record_failure "AWS secret '${secret_name}' is missing or inaccessible in ${AWS_REGION}"
    fi
  done
}

check_secret_unpacking() {
  if [[ "$CHECK_SECRET_UNPACK" != "1" ]]; then
    return
  fi

  echo
  echo "Secret JSON unpack checks:"

  if compose run --rm --no-deps api python - <<'PY'
from dokumen_aws_secrets import load_stage_groups

required = {
    "api": ["API_DATABASE_URL", "REDIS_URL", "API_KEY", "AVATARS_S3_BUCKET_NAME"],
    "runpod": ["OCR_MODEL"],
}
values = load_stage_groups(groups=["api", "runpod"])
missing = [key for keys in required.values() for key in keys if key not in values or values[key] in ("", None)]
if missing:
    raise SystemExit(f"api secret JSON missing keys after unpack: {', '.join(missing)}")
print("api/runpod JSON unpack: ok")
PY
  then
    :
  else
    record_failure "api/runpod secret JSON did not unpack to required keys"
  fi

  if compose run --rm --no-deps worker python - <<'PY'
from dokumen_aws_secrets import load_stage_groups

required = {
    "workers": ["WORKERS_DATABASE_URL", "REDIS_URL", "STRIPE_SECRET_KEY"],
    "runpod": ["OCR_MODEL"],
}
values = load_stage_groups(groups=["workers", "runpod"])
missing = [key for keys in required.values() for key in keys if key not in values or values[key] in ("", None)]
if missing:
    raise SystemExit(f"workers secret JSON missing keys after unpack: {', '.join(missing)}")
print("workers/runpod JSON unpack: ok")
PY
  then
    :
  else
    record_failure "workers/runpod secret JSON did not unpack to required keys"
  fi
}

check_internal_services() {
  echo
  echo "Informational internal probes:"
  if compose exec -T redis redis-cli ping | grep -qx PONG; then
    echo "redis ping: PONG"
  else
    echo "redis ping: failed"
  fi

  if compose exec -T worker python -m app.healthcheck --json; then
    echo "worker health command: passed"
  else
    echo "worker health command: failed"
  fi
}

check_compose_services
check_bootstrap_env
check_aws_secrets
check_secret_unpacking
check_host_ports
check_internal_services

if (( ${#FAILURES[@]} > 0 )); then
  echo
  echo "EC2 health checks failed:"
  printf '  - %s\n' "${FAILURES[@]}"
  print_failure_context >&2
  exit 1
fi

echo "EC2 health checks passed."

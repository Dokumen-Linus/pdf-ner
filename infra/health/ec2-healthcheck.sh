#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-infra/.env.prod}"
LOG_LINES="${LOG_LINES:-120}"
MAX_RESTARTS="${MAX_RESTARTS:-}"
REQUIRED_SERVICES=(nginx-proxy-manager redis api worker web)
HOST_PORT_CHECKS=(
  "nginx-proxy-manager:127.0.0.1:80"
  "nginx-proxy-manager:127.0.0.1:81"
  "nginx-proxy-manager:127.0.0.1:443"
  "api:127.0.0.1:8000"
  "web:127.0.0.1:3000"
)
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

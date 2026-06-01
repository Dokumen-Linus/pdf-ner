#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CLOUDWATCH_LOG_GROUP_PREFIX="${CLOUDWATCH_LOG_GROUP_PREFIX:-/dokumen/production/ec2}"
CLOUDWATCH_LOG_RETENTION_DAYS="${CLOUDWATCH_LOG_RETENTION_DAYS:-14}"
CLOUDWATCH_AGENT_CONFIG_PATH="${CLOUDWATCH_AGENT_CONFIG_PATH:-/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-agent.json}"

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Required command not found: ${name}" >&2
    exit 1
  fi
}

validate_retention_days() {
  case "$CLOUDWATCH_LOG_RETENTION_DAYS" in
    1|3|5|7|14|30|60|90|120|150|180|365|400|545|731|1096|1827|2192|2557|2922|3288|3653)
      ;;
    *)
      echo "CLOUDWATCH_LOG_RETENTION_DAYS must be a CloudWatch Logs retention value; got '${CLOUDWATCH_LOG_RETENTION_DAYS}'." >&2
      exit 1
      ;;
  esac
}

require_dnf() {
  if ! command -v dnf >/dev/null 2>&1; then
    echo "Unsupported host OS: this script requires dnf, such as on Amazon Linux 2023." >&2
    exit 1
  fi
}

install_packages() {
  sudo dnf install -y \
    amazon-cloudwatch-agent \
    jq \
    rsyslog
}

enable_rsyslog() {
  if systemctl list-unit-files rsyslog.service >/dev/null 2>&1; then
    sudo systemctl enable --now rsyslog
  fi
}

write_cloudwatch_agent_config() {
  local config_dir config_tmp
  config_dir="$(dirname "$CLOUDWATCH_AGENT_CONFIG_PATH")"
  config_tmp="$(mktemp)"

  jq -n \
    --arg region "$AWS_REGION" \
    --arg prefix "$CLOUDWATCH_LOG_GROUP_PREFIX" \
    --argjson retention "$CLOUDWATCH_LOG_RETENTION_DAYS" \
    '{
      agent: {
        region: $region,
        debug: false
      },
      logs: {
        logs_collected: {
          files: {
            collect_list: [
              {
                file_path: "/var/lib/docker/containers/*/*.log",
                log_group_name: "\($prefix)/docker",
                log_stream_name: "{instance_id}/docker",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/messages",
                log_group_name: "\($prefix)/system",
                log_stream_name: "{instance_id}/messages",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/secure",
                log_group_name: "\($prefix)/system",
                log_stream_name: "{instance_id}/secure",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/cloud-init.log",
                log_group_name: "\($prefix)/system",
                log_stream_name: "{instance_id}/cloud-init",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/cloud-init-output.log",
                log_group_name: "\($prefix)/system",
                log_stream_name: "{instance_id}/cloud-init-output",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/dnf.log",
                log_group_name: "\($prefix)/system",
                log_stream_name: "{instance_id}/dnf",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/amazon/ssm/amazon-ssm-agent.log",
                log_group_name: "\($prefix)/ssm",
                log_stream_name: "{instance_id}/amazon-ssm-agent",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/amazon/ssm/errors.log",
                log_group_name: "\($prefix)/ssm",
                log_stream_name: "{instance_id}/errors",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/amazon/ssm/audits/amazon-ssm-agent-audit-*",
                log_group_name: "\($prefix)/ssm-audit",
                log_stream_name: "{instance_id}/audit",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log",
                log_group_name: "\($prefix)/cloudwatch-agent",
                log_stream_name: "{instance_id}/amazon-cloudwatch-agent",
                retention_in_days: $retention,
                timezone: "UTC"
              },
              {
                file_path: "/var/log/cloudflared.log",
                log_group_name: "\($prefix)/cloudflared",
                log_stream_name: "{instance_id}/cloudflared",
                retention_in_days: $retention,
                timezone: "UTC"
              }
            ]
          }
        }
      }
    }' > "$config_tmp"

  sudo install -d -m 0755 "$config_dir"
  sudo install -m 0644 "$config_tmp" "$CLOUDWATCH_AGENT_CONFIG_PATH"
  rm -f "$config_tmp"
}

start_cloudwatch_agent() {
  sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c "file:${CLOUDWATCH_AGENT_CONFIG_PATH}"

  sudo systemctl enable --now amazon-cloudwatch-agent
}

verify_cloudwatch_agent() {
  sudo systemctl is-active --quiet amazon-cloudwatch-agent
  sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status
}

require_dnf
require_cmd sudo
validate_retention_days
install_packages
enable_rsyslog
write_cloudwatch_agent_config
start_cloudwatch_agent
verify_cloudwatch_agent

echo "CloudWatch log shipping is configured for ${CLOUDWATCH_LOG_GROUP_PREFIX} in ${AWS_REGION}."

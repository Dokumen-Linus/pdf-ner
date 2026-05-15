#!/usr/bin/env bash
# Compatibility entrypoint for the new fixed-Pod deployment flow.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat <<'EOF'
runpod-setup.sh now deploys fixed Runpod Pods backed by AWS ECR.
It no longer creates Runpod Serverless templates or endpoints.
EOF

exec bash "${SCRIPT_DIR}/runpod-deploy-pods.sh" "$@"

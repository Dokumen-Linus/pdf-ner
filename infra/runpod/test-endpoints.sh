#!/usr/bin/env bash
# Compatibility entrypoint for the new fixed-Pod smoke tests.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat <<'EOF'
test-endpoints.sh now tests fixed Runpod Pod proxy URLs.
It no longer tests Runpod Serverless endpoint URLs.
EOF

exec bash "${SCRIPT_DIR}/test-pods.sh" "$@"

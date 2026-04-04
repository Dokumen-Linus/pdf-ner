#!/usr/bin/env bash
set -euo pipefail

FILE=$(jq -r '.tool_input.file_path // ""')

[[ -z "$FILE" ]] && exit 0

if [[ "$FILE" == *.py ]]; then
  ruff format "$FILE" 2>/dev/null || true
elif [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  cd "$REPO_ROOT/web"
  bunx prettier --write "$FILE" 2>/dev/null || true
fi

exit 0

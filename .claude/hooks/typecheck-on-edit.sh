#!/usr/bin/env bash
set -euo pipefail

FILE=$(jq -r '.tool_input.file_path // ""')

[[ -z "$FILE" ]] && exit 0

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  cd "$REPO_ROOT/web"
  bunx tsc --noEmit 2>&1
fi

exit 0

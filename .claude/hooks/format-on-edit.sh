#!/usr/bin/env bash
set -euo pipefail

FILE=$(python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

[[ -z "$FILE" ]] && exit 0

if [[ "$FILE" == *.py ]]; then
  ruff format "$FILE" 2>/dev/null || true
elif [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  cd "$REPO_ROOT/web"
  bunx prettier --write "$FILE" 2>/dev/null || true
  bunx eslint --fix . 2>/dev/null || true
fi

exit 0

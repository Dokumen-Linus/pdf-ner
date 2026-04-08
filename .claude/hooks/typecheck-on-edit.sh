#!/usr/bin/env bash
set -euo pipefail

FILE=$(python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

[[ -z "$FILE" ]] && exit 0

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  cd "$REPO_ROOT/web"
  bunx tsc --noEmit 2>&1 || true
fi

exit 0

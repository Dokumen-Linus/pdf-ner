#!/usr/bin/env bash
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CHANGED=$(cd "$ROOT" && git diff HEAD --name-only 2>/dev/null)
FAILED=""

# web: if any .ts/.tsx files changed under web/
if echo "$CHANGED" | grep -E '^web/.*\.(ts|tsx)$' | grep -qvE '\.gen\.ts$'; then
  cd "$ROOT/web" && bun run test 2>&1 || FAILED="$FAILED web:unit"
  cd "$ROOT/web" && bun run test:e2e 2>&1 || FAILED="$FAILED web:e2e"
fi

# api: if any .py files changed under api/
if echo "$CHANGED" | grep -qE '^api/.*\.py$'; then
  cd "$ROOT/api" && pytest -v 2>&1 || FAILED="$FAILED api"
fi

# workers: if any .py files changed under workers/
if echo "$CHANGED" | grep -qE '^workers/.*\.py$'; then
  cd "$ROOT/workers" && pytest -v 2>&1 || FAILED="$FAILED workers"
fi

if [ -n "$FAILED" ]; then
  echo "{\"decision\": \"block\", \"reason\": \"Test suites failed:$FAILED. Fix failures before stopping.\"}"
fi

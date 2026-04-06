#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

cmd=$(echo "$input" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

printf '%s %s\n' "$(date -Is)" "$cmd" >> .claude/command.log

exit 0

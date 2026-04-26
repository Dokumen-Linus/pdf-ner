import json
from pathlib import Path
import sys

import format_on_edit
import typecheck_on_edit

HOOK_DIR = Path(__file__).resolve().parent
if str(HOOK_DIR) not in sys.path:
    sys.path.insert(0, str(HOOK_DIR))

def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    format_on_edit.main(payload)
    return typecheck_on_edit.main(payload)


if __name__ == "__main__":
    raise SystemExit(main())

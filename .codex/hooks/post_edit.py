import json
import sys

import format_on_edit
import typecheck_on_edit


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    format_on_edit.main(payload)
    return typecheck_on_edit.main(payload)


if __name__ == "__main__":
    raise SystemExit(main())

from datetime import UTC, datetime
import json
from pathlib import Path
import sys


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    command = payload.get("tool_input", {}).get("command", "")
    repo_root = Path(__file__).resolve().parents[2]
    log_path = repo_root / ".codex" / "logs" / "command.log"
    timestamp = datetime.now(UTC).astimezone().isoformat()

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"{timestamp} {command}\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

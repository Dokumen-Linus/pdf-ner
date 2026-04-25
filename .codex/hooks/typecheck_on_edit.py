import json
from pathlib import Path
import sys
import subprocess

HOOK_DIR = Path(__file__).resolve().parent
if str(HOOK_DIR) not in sys.path:
    sys.path.insert(0, str(HOOK_DIR))

from _changed_files import executable, load_payload, paths_from_payload, repo_root


def main(payload=None) -> int:
    root = repo_root()
    web_root = (root / "web").resolve()
    edited = [
        path
        for path in paths_from_payload(payload if payload is not None else load_payload())
        if path.suffix in {".ts", ".tsx"}
    ]
    if not edited:
        return 0

    typecheck = subprocess.run(
        [executable("bunx"), "tsc", "--noEmit"],
        cwd=web_root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )

    for path in edited:
        subprocess.run(
            [executable("bunx"), "eslint", "--fix", str(path)],
            cwd=web_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    output = typecheck.stdout or ""
    edited_names = {
        path.relative_to(web_root).as_posix() if path.is_relative_to(web_root) else path.name
        for path in edited
    }
    relevant = [line for line in output.splitlines() if any(name in line for name in edited_names)]

    if typecheck.returncode != 0 and relevant:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PostToolUse",
                        "additionalContext": "TypeScript check reported issues related to the edited file:\n"
                        + "\n".join(relevant[:50]),
                    }
                }
            )
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

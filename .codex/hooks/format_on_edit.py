from pathlib import Path
import sys
import subprocess

HOOK_DIR = Path(__file__).resolve().parent
if str(HOOK_DIR) not in sys.path:
    sys.path.insert(0, str(HOOK_DIR))

from _changed_files import executable, load_payload, paths_from_payload, repo_root


def run(command: list[str], cwd: Path) -> None:
    subprocess.run(
        command, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False
    )


def main(payload=None) -> int:
    root = repo_root()
    web_root = root / "web"

    for path in paths_from_payload(payload if payload is not None else load_payload()):
        if path.suffix == ".py":
            run([executable("ruff"), "format", str(path)], root)
        elif path.suffix in {".ts", ".tsx"}:
            run([executable("bunx"), "prettier", "--write", str(path)], web_root)
            run([executable("bunx"), "eslint", "--fix", "."], web_root)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

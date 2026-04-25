import json
from pathlib import Path
import subprocess

from _changed_files import executable, repo_root


def changed_files(root: Path) -> list[str]:
    result = subprocess.run(
        [executable("git"), "diff", "HEAD", "--name-only"],
        cwd=root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode != 0:
        return []
    return [Path(line.strip()).as_posix() for line in result.stdout.splitlines() if line.strip()]


def run(command: list[str], cwd: Path) -> bool:
    result = subprocess.run(
        command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False
    )
    return result.returncode == 0


def main() -> int:
    root = repo_root()
    changed = changed_files(root)
    failed: list[str] = []

    if any(
        path.startswith("web/") and path.endswith((".ts", ".tsx")) and not path.endswith(".gen.ts")
        for path in changed
    ):
        if not run([executable("bun"), "run", "test"], root / "web"):
            failed.append("web:unit")
        if not run([executable("bun"), "run", "test:e2e"], root / "web"):
            failed.append("web:e2e")

    if any(path.startswith("api/") and path.endswith(".py") for path in changed):
        if not run([executable("pytest"), "-v"], root / "api"):
            failed.append("api")

    if any(path.startswith("workers/") and path.endswith(".py") for path in changed):
        if not run([executable("pytest"), "-v"], root / "workers"):
            failed.append("workers")

    if failed:
        print(
            json.dumps(
                {
                    "decision": "block",
                    "reason": f"Test suites failed: {' '.join(failed)}. Fix failures before stopping.",
                }
            )
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

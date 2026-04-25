from pathlib import Path
import sys
import subprocess

HOOK_DIR = Path(__file__).resolve().parent
if str(HOOK_DIR) not in sys.path:
    sys.path.insert(0, str(HOOK_DIR))

from _changed_files import executable, repo_root


def main() -> int:
    subprocess.run(
        [executable("npx"), "-y", "codesight", "--wiki"],
        cwd=repo_root(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import subprocess

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

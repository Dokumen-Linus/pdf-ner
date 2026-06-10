from __future__ import annotations

from pathlib import Path
import shutil
import subprocess

from _hook_files import (
    command_failure_context,
    emit_post_tool_context,
    executable,
    get_os,
    load_payload,
    paths_from_payload,
    record_paths,
    repo_root,
    shell_command,
)

WEB_FORMAT_SUFFIXES = {".js", ".jsx", ".ts", ".tsx"}


def run(command: list[str], cwd: Path, name: str) -> str | None:
    result = subprocess.run(
        shell_command(command),
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if result.returncode != 0:
        return command_failure_context(name, result)
    return None


def web_relative(paths: list[Path], web_root: Path) -> list[str]:
    relative: list[str] = []
    for path in paths:
        try:
            relative.append(path.resolve().relative_to(web_root).as_posix())
        except ValueError:
            continue
    return relative


def main() -> int:
    payload = load_payload()
    root = repo_root()
    web_root = root / "web"
    edited = paths_from_payload(payload)
    record_paths(payload, edited)

    failures: list[str] = []
    python_files = [path for path in edited if path.suffix == ".py"]
    web_files = [
        path
        for path in edited
        if path.suffix in WEB_FORMAT_SUFFIXES and path.resolve().is_relative_to(web_root.resolve())
    ]

    if python_files:
        # On Windows, prefer 'py -m ruff' if available; fallback to 'ruff'
        if get_os() == "windows" and shutil.which("py"):
            ruff_cmd = ["py", "-m", "ruff", "format", *map(str, python_files)]
        else:
            ruff_cmd = [executable("ruff"), "format", *map(str, python_files)]
        failure = run(ruff_cmd, root, "ruff format")
        if failure:
            failures.append(failure)

    relative_web_files = web_relative(web_files, web_root)
    if relative_web_files:
        # On Windows, bun/bunx may be .cmd scripts; shell_command handles that
        bunx = executable("bunx")
        failure = run(
            [bunx, "prettier", "--write", *relative_web_files],
            web_root,
            "prettier",
        )
        if failure:
            failures.append(failure)

        failure = run(
            [bunx, "eslint", "--fix", *relative_web_files],
            web_root,
            "eslint",
        )
        if failure:
            failures.append(failure)

    if failures:
        emit_post_tool_context("\n\n".join(failures))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

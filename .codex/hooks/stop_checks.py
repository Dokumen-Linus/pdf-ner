from __future__ import annotations

from pathlib import Path
import subprocess
import tokenize

from _hook_files import (
    command_failure_context,
    emit_stop_block,
    executable,
    load_payload,
    load_recorded_paths,
    repo_root,
)

WEB_TEST_SUFFIXES = {".js", ".jsx", ".ts", ".tsx"}
WEB_TYPECHECK_SUFFIXES = {".ts", ".tsx"}


def run(command: list[str], cwd: Path, name: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )


def web_relative(paths: list[Path], web_root: Path) -> set[str]:
    relative: set[str] = set()
    for path in paths:
        try:
            relative.add(path.resolve().relative_to(web_root).as_posix())
        except ValueError:
            continue
    return relative


def typecheck_failure_context(
    result: subprocess.CompletedProcess[str], edited_names: set[str]
) -> str:
    output = result.stdout or ""
    relevant = [line for line in output.splitlines() if any(name in line for name in edited_names)]
    if relevant:
        limited = "\n".join(relevant[:80])
        if len(relevant) > 80:
            limited += "\n... output truncated ..."
        return f"bunx tsc reported issues related to edited files:\n{limited}"
    return command_failure_context("bunx tsc", result)


def compile_python_files(paths: list[Path]) -> list[str]:
    failures: list[str] = []
    for path in paths:
        try:
            with tokenize.open(path) as handle:
                source = handle.read()
            compile(source, str(path), "exec")
        except (OSError, SyntaxError, UnicodeError) as error:
            failures.append(f"{path}: {error}")
    return failures


def python_project_roots(paths: list[Path], root: Path) -> list[Path]:
    projects: set[Path] = set()
    packages_root = root / "packages"

    for path in paths:
        try:
            rel = path.resolve().relative_to(root)
        except ValueError:
            continue
        parts = rel.parts
        if not parts:
            continue
        if parts[0] in {"api", "workers"} and (root / parts[0] / "pyproject.toml").exists():
            projects.add(root / parts[0])
        elif (
            len(parts) >= 2
            and parts[0] == "packages"
            and (packages_root / parts[1] / "pyproject.toml").exists()
        ):
            projects.add(packages_root / parts[1])

    return sorted(projects)


def main() -> int:
    payload = load_payload()
    root = repo_root()
    web_root = root / "web"
    edited = load_recorded_paths(payload)
    if not edited:
        return 0

    failures: list[str] = []
    python_files = [path for path in edited if path.suffix == ".py"]
    if python_files:
        compile_failures = compile_python_files(python_files)
        if compile_failures:
            failures.append("Python compile check failed:\n" + "\n".join(compile_failures[:80]))

    web_files = [
        path
        for path in edited
        if path.suffix in WEB_TEST_SUFFIXES and path.resolve().is_relative_to(web_root.resolve())
    ]
    typecheck_files = [path for path in web_files if path.suffix in WEB_TYPECHECK_SUFFIXES]
    edited_typecheck_names = web_relative(typecheck_files, web_root)
    if edited_typecheck_names:
        result = run(
            [executable("bunx"), "tsc", "--noEmit", "--pretty", "false"],
            web_root,
            "bunx tsc",
        )
        if result.returncode != 0:
            failures.append(typecheck_failure_context(result, edited_typecheck_names))

    if web_files:
        result = run([executable("bun"), "test"], web_root, "bun test")
        if result.returncode != 0:
            failures.append(command_failure_context("bun test", result))

    for project_root in python_project_roots(python_files, root):
        label = f"pytest ({project_root.relative_to(root).as_posix()})"
        result = run([executable("pytest")], project_root, label)
        if result.returncode != 0:
            failures.append(command_failure_context(label, result))

    if failures:
        emit_stop_block(failures)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any

PATCH_FILE_RE = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", re.MULTILINE)


def repo_root() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=Path(__file__).resolve().parent,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode == 0:
        return Path(result.stdout.strip()).resolve()
    return Path(__file__).resolve().parents[2]


def executable(name: str) -> str:
    return shutil.which(name) or name


def _normalize(path: str) -> str:
    return path.strip().strip("\"'")


def paths_from_payload(payload: dict[str, Any]) -> list[Path]:
    tool_input = payload.get("tool_input", {})
    candidates: list[str] = []

    for key in ("file_path", "path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            candidates.append(value)

    command = tool_input.get("command")
    if isinstance(command, str):
        candidates.extend(_normalize(match) for match in PATCH_FILE_RE.findall(command))

    root = repo_root()
    paths: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        path = Path(candidate)
        if not path.is_absolute():
            path = root / path
        try:
            resolved = path.resolve()
        except OSError:
            resolved = path
        if resolved not in seen:
            seen.add(resolved)
            paths.append(resolved)

    return paths


def load_payload() -> dict[str, Any]:
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError:
        return {}

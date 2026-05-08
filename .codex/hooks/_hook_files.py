from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any

PATCH_FILE_RE = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", re.MULTILINE)
MOVE_FILE_RE = re.compile(r"^\*\*\* Move to: (.+)$", re.MULTILINE)


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


def load_payload() -> dict[str, Any]:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _iter_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        strings: list[str] = []
        for child in value.values():
            strings.extend(_iter_strings(child))
        return strings
    if isinstance(value, list):
        strings: list[str] = []
        for child in value:
            strings.extend(_iter_strings(child))
        return strings
    return []


def _normalize(path: str) -> str:
    return path.strip().strip("\"'")


def _candidate_paths(payload: dict[str, Any]) -> list[str]:
    tool_input = payload.get("tool_input", {})
    if not isinstance(tool_input, dict):
        return []

    candidates: list[str] = []
    for key in ("file_path", "path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            candidates.append(value)

    for text in _iter_strings(tool_input):
        candidates.extend(_normalize(match) for match in PATCH_FILE_RE.findall(text))
        candidates.extend(_normalize(match) for match in MOVE_FILE_RE.findall(text))

    return candidates


def paths_from_payload(payload: dict[str, Any], *, existing_only: bool = True) -> list[Path]:
    root = repo_root()
    paths: list[Path] = []
    seen: set[Path] = set()

    for candidate in _candidate_paths(payload):
        path = Path(candidate)
        if not path.is_absolute():
            path = root / path
        try:
            resolved = path.resolve()
        except OSError:
            resolved = path
        try:
            resolved.relative_to(root)
        except ValueError:
            continue
        if existing_only and not resolved.exists():
            continue
        if resolved not in seen:
            seen.add(resolved)
            paths.append(resolved)

    return paths


def to_repo_relative(path: Path) -> str:
    return path.resolve().relative_to(repo_root()).as_posix()


def state_key(payload: dict[str, Any]) -> str:
    session_id = str(payload.get("session_id") or "unknown-session")
    turn_id = str(payload.get("turn_id") or "unknown-turn")
    return hashlib.sha256(f"{session_id}\0{turn_id}".encode("utf-8")).hexdigest()


def state_path(payload: dict[str, Any]) -> Path:
    root_hash = hashlib.sha256(str(repo_root()).encode("utf-8")).hexdigest()[:16]
    return (
        Path(tempfile.gettempdir())
        / "codex-pdf-ner-hooks"
        / root_hash
        / f"{state_key(payload)}.json"
    )


def load_recorded_paths(payload: dict[str, Any]) -> list[Path]:
    path = state_path(payload)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    root = repo_root()
    paths: list[Path] = []
    seen: set[Path] = set()
    for value in data.get("paths", []):
        if not isinstance(value, str):
            continue
        candidate = (root / value).resolve()
        if not candidate.exists() or candidate in seen:
            continue
        seen.add(candidate)
        paths.append(candidate)
    return paths


def record_paths(payload: dict[str, Any], paths: list[Path]) -> None:
    if not paths:
        return

    path = state_path(payload)
    path.parent.mkdir(parents=True, exist_ok=True)

    existing = {to_repo_relative(recorded) for recorded in load_recorded_paths(payload)}
    existing.update(to_repo_relative(edited) for edited in paths if edited.exists())
    path.write_text(
        json.dumps({"paths": sorted(existing)}, indent=2) + "\n",
        encoding="utf-8",
    )


def command_failure_context(name: str, result: subprocess.CompletedProcess[str]) -> str:
    output = (result.stdout or "") + (result.stderr or "")
    output = output.strip()
    if len(output) > 4000:
        output = output[:4000] + "\n... output truncated ..."
    if not output:
        output = "(no output)"
    return f"{name} failed with exit code {result.returncode}:\n{output}"


def emit_post_tool_context(message: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": message,
                }
            }
        )
    )


def emit_stop_block(reasons: list[str]) -> None:
    print(
        json.dumps(
            {
                "decision": "block",
                "reason": "Edited-area checks failed:\n\n"
                + "\n\n".join(reasons)
                + "\n\nFix these failures before ending the turn.",
            }
        )
    )

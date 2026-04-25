#!/usr/bin/env python3
"""Generate infra/.env.example from the service example files and role setup script."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_LINE_RE = re.compile(r"^([A-Z0-9_]+)=(.*)$")
ROLE_PASSWORD_RE = re.compile(r"CREATE ROLE \w+ LOGIN PASSWORD '\$\{([A-Z0-9_]+)\}';")

SOURCE_FILES = {
    "workers": ROOT / "workers" / ".env.local.example",
    "api": ROOT / "api" / ".env.local.example",
    "web": ROOT / "web" / ".env.local.example",
}

OVERRIDES = {
    "BETTER_AUTH_SECRET": "generate-with-openssl-rand-base64-32",
    "BETTER_AUTH_URL": "https://yourdomain.com",
    "FROM_EMAIL": "no-reply@yourdomain.com",
    "MY_EMAIL": "admin@yourdomain.com",
    "STRIPE_SECRET_KEY": "sk_live_...",
}

COMMENT_LINES_BEFORE_KEYS = {
    "AWS_ENDPOINT_URL": "# Optional: override SES endpoint for local testing (e.g. LocalStack)",
}

DB_URL_KEYS = {"API_DATABASE_URL", "AUTH_DATABASE_URL", "WEB_DATABASE_URL"}
GENERATED_DEFAULTS = {
    "POSTGRES_PASSWORD": "changeme",
    "WORKERS_DATABASE_URL": "postgres://workers_user:changeme@localhost:5432/dokumen?sslmode=disable",
}


def parse_env_file(path: Path) -> dict[str, str]:
    env_vars: dict[str, str] = {}

    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        match = ENV_LINE_RE.fullmatch(line)
        if match is None:
            raise ValueError(f"Unexpected line in {path}:{line_number}: {raw_line}")

        key, value = match.groups()
        if key in env_vars:
            raise ValueError(f"Duplicate key {key!r} in {path}")

        env_vars[key] = value

    return env_vars


def parse_role_password_keys(path: Path) -> list[str]:
    role_password_keys: list[str] = []

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        match = ROLE_PASSWORD_RE.search(raw_line)
        if match:
            role_password_keys.append(match.group(1))

    if not role_password_keys:
        raise ValueError(f"No role password env vars found in {path}")

    return role_password_keys


def normalize_value(key: str, value: str) -> str:
    if key in DB_URL_KEYS:
        value = value.replace(":...@", ":changeme@")

    return OVERRIDES.get(key, value)


def generated_value(key: str, role_password_keys: list[str]) -> str:
    if key in role_password_keys:
        return "changeme"

    if key in GENERATED_DEFAULTS:
        return GENERATED_DEFAULTS[key]

    raise KeyError(f"No generated value configured for {key}")


def resolve_value(
    key: str,
    source_names: tuple[str, ...],
    sources: dict[str, dict[str, str]],
    role_password_keys: list[str],
) -> str:
    if not source_names:
        return generated_value(key, role_password_keys)

    for source_name in source_names:
        value = sources[source_name].get(key)
        if value is not None:
            return normalize_value(key, value)

    joined_sources = ", ".join(source_names)
    raise KeyError(f"Missing {key} in sources: {joined_sources}")


def build_sections(role_password_keys: list[str]) -> list[tuple[str, list[tuple[str, tuple[str, ...]]]]]:
    return [
        (
            "# PostgreSQL superuser (for initial setup - usually provided by your PostgreSQL service/docker-compose)",
            [("POSTGRES_PASSWORD", tuple())],
        ),
        (
            "# Role passwords - must match what you set in db/init/01_roles.sh",
            [(key, tuple()) for key in role_password_keys],
        ),
        ("# Redis", [("REDIS_URL", ("api",))]),
        ("# Better Auth", [("BETTER_AUTH_SECRET", ("web",)), ("BETTER_AUTH_URL", ("web",))]),
        (
            "# Email (AWS SES) — FROM_EMAIL must be a verified identity in SES for AWS_REGION",
            [
                ("AWS_ACCESS_KEY_ID", ("web",)),
                ("AWS_SECRET_ACCESS_KEY", ("web",)),
                ("AWS_REGION", ("web",)),
                ("AWS_ENDPOINT_URL", ("web",)),
                ("FROM_EMAIL", ("web",)),
                ("MY_EMAIL", ("web",)),
            ],
        ),
        ("# Stripe", [("STRIPE_SECRET_KEY", ("web", "api", "workers"))]),
        (
            "# Workers (workers/.env.local.example)",
            [
                ("WORKERS_DATABASE_URL", tuple()),
                ("ANTHROPIC_API_KEY", ("workers", "api")),
                ("OPENAI_API_KEY", ("workers", "api")),
                ("GOOGLE_AI_API_KEY", ("workers", "api")),
            ],
        ),
        (
            "# API (api/.env.local.example)",
            [
                ("API_DATABASE_URL", ("api",)),
                ("API_KEY", ("api",)),
                ("CORS_ORIGINS", ("api",)),
                ("ALLOWED_HOSTS", ("api",)),
            ],
        ),
        (
            "# Avatars (S3 compatible)",
            [
                ("AVATARS_BUCKET", ("api",)),
                ("AVATARS_AWS_ACCESS_KEY_ID", ("api",)),
                ("AVATARS_AWS_SECRET_ACCESS_KEY", ("api",)),
                ("AVATARS_AWS_REGION", ("api",)),
                ("AVATARS_AWS_ENDPOINT_URL", ("api",)),
            ],
        ),
        (
            "# Runpod OCR",
            [
                ("OCR_MODEL", ("workers", "api")),
                ("DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL", ("workers", "api")),
                ("OLM_OCR2_RUNPOD_ENDPOINT_URL", ("workers", "api")),
                ("RUNPOD_API_KEY", ("workers", "api")),
                ("OCR_RUNPOD_TIMEOUT_SECONDS", ("workers", "api")),
                ("OCR_RUNPOD_RETRIES", ("workers", "api")),
            ],
        ),
        (
            "# Web (web/.env.local.example)",
            [
                ("DATABASE_URL", ("web",)),
                ("AUTH_DATABASE_URL", ("web",)),
                ("WEB_DATABASE_URL", ("web",)),
                ("BASE_URL", ("web",)),
                ("UPLOADTHING_TOKEN", ("web",)),
            ],
        ),
        (
            "# Client-side env vars (Vite)",
            [("VITE_BASE_URL", ("web",)), ("VITE_STRIPE_PUBLISHABLE_KEY", ("web",))],
        ),
    ]


def validate_output_keys(
    output_keys: set[str], sources: dict[str, dict[str, str]], role_password_keys: list[str]
) -> None:
    expected_keys = set(role_password_keys) | set(GENERATED_DEFAULTS)
    for env_vars in sources.values():
        expected_keys.update(env_vars)

    missing_keys = sorted(expected_keys - output_keys)
    unexpected_keys = sorted(output_keys - expected_keys)
    if missing_keys or unexpected_keys:
        problems: list[str] = []
        if missing_keys:
            problems.append(f"missing keys: {', '.join(missing_keys)}")
        if unexpected_keys:
            problems.append(f"unexpected keys: {', '.join(unexpected_keys)}")
        raise ValueError("Section definitions are out of sync with source files: " + "; ".join(problems))


def render_env_example() -> str:
    sources = {name: parse_env_file(path) for name, path in SOURCE_FILES.items()}
    role_password_keys = parse_role_password_keys(ROOT / "db" / "init" / "01_roles.sh")
    sections = build_sections(role_password_keys)

    lines: list[str] = []
    output_keys: set[str] = set()

    for index, (header, entries) in enumerate(sections):
        if index > 0:
            lines.append("")

        lines.append(header)

        for key, source_names in entries:
            if key in output_keys:
                raise ValueError(f"Duplicate output key {key}")

            value = resolve_value(key, source_names, sources, role_password_keys)
            comment = COMMENT_LINES_BEFORE_KEYS.get(key)
            if comment is not None:
                lines.append(comment)
            lines.append(f"{key}={value}")
            output_keys.add(key)

    validate_output_keys(output_keys, sources, role_password_keys)
    return "\n".join(lines) + "\n"


def main() -> None:
    output = ROOT / "infra" / ".env.example"
    output.write_text(render_env_example(), encoding="utf-8")
    print(f"Written to: {output}")


if __name__ == "__main__":
    main()

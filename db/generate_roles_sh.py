"""Generate db/init/01_roles.sh from db/migrations/_init.sql.

Replaces hardcoded password placeholders with Docker environment variable
references so the same role/schema/privilege definitions stay in one place
(_init.sql) and the Docker init script is always in sync.

Usage:
    python generate_roles_sh.py
"""

import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
INIT_SQL = SCRIPT_DIR / "migrations" / "_init.sql"
OUTPUT = SCRIPT_DIR / "init" / "01_roles.sh"

HEADER = """\
#!/bin/bash
# AUTO-GENERATED from _init.sql by generate_roles_sh.py — do not edit by hand.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
"""

FOOTER = "EOSQL\n"


def env_var_for_role(role: str) -> str:
    return f"{role.upper()}_PASSWORD"


def transform(sql: str) -> str:
    # Replace: PASSWORD '...'  ->  PASSWORD '${ROLE_NAME_PASSWORD}'
    # Captures the role name from the preceding CREATE ROLE statement.
    def replace_password(m: re.Match) -> str:
        role = m.group(1).strip()
        return f"CREATE ROLE {role} LOGIN PASSWORD '${{{env_var_for_role(role)}}}';"

    out = re.sub(
        r"CREATE ROLE\s+(\w+)\s+LOGIN\s+PASSWORD\s+'[^']*'\s*;",
        replace_password,
        sql,
    )

    # Indent every non-empty line with 4 spaces for the heredoc body.
    lines = out.splitlines()
    indented = "\n".join(f"    {line}" if line.strip() else "" for line in lines)
    return indented


def main() -> None:
    sql = INIT_SQL.read_text(encoding="utf-8")
    body = transform(sql)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(HEADER + body + "\n" + FOOTER, encoding="utf-8", newline="\n")
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    main()

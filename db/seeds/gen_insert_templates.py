#!/usr/bin/env python3
"""Generate SQL seed file from template text files.

Reads db/seeds/templates/{1,2,3}.txt and generates a new SQL file
that inserts all three templates into public.templates with all
boolean columns set to true. Does not set created_at or updated_at
(they have DEFAULT now()).
"""

import os
import re


def extract_inserts(text: str) -> list[str]:
    """Extract all insert placeholders that start with < and end with >."""
    pattern = r"<[^>]*>"
    return re.findall(pattern, text)


def escape_sql_string(text: str) -> str:
    """Escape single quotes for SQL string literal."""
    return text.replace("'", "''")


def format_sql_array(items: list[str]) -> str:
    """Format Python list as PostgreSQL array literal."""
    escaped_items = [f"'{escape_sql_string(item)}'" for item in items]
    return "ARRAY[" + ",".join(escaped_items) + "]"


def read_template(template_number: int) -> tuple[str, list[str]]:
    """Read a template file and return (content, inserts)."""
    template_path = os.path.join(os.path.dirname(__file__), "templates", f"{template_number}.txt")
    with open(template_path, encoding="utf-8") as f:
        content = f.read()
    inserts = extract_inserts(content)
    return content, inserts


def generate_seed() -> str:
    """Generate the SQL seed content."""
    templates_dir = os.path.join(os.path.dirname(__file__), "templates")
    template_files = sorted([f for f in os.listdir(templates_dir) if f.endswith(".txt")])

    values_lines = []
    for filename in template_files:
        template_number = int(filename.replace(".txt", ""))
        content, inserts = read_template(template_number)
        escaped_txt = escape_sql_string(content)
        inserts_array = format_sql_array(inserts)

        values_lines.append(f"('{escaped_txt}', {inserts_array}, true, true, true, true, true)")

    values_sql = ",\n".join(values_lines)

    sql = f"""INSERT INTO public.templates (
  txt,
  inserts,
  includes_project_description,
  includes_entity_type_definitions,
  includes_entity_type_example_values,
  includes_entity_type_example_finds,
  includes_entity_type_regex
)
VALUES
{values_sql};"""

    return sql


def main() -> None:
    sql = generate_seed()

    # Generate timestamped filename like the old script did
    from datetime import datetime

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(os.path.dirname(__file__), f"{timestamp}.sql")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"Generated SQL seed file: {output_path}")
    print(
        f"Inserted {len([f for f in os.listdir(os.path.join(os.path.dirname(__file__), 'templates')) if f.endswith('.txt')])} templates"
    )


if __name__ == "__main__":
    main()

from datetime import datetime
import os
import re

TEMPLATE_NUMBER = 1
DOCUMENT_AT_END = "true"


def extract_inserts(text: str) -> list[str]:
    """Extract all substrings that start with < and end with >"""
    pattern = r"<[^>]*>"
    return re.findall(pattern, text)


def escape_sql_string(text: str) -> str:
    """Escape single quotes for SQL string literal"""
    return text.replace("'", "''")


def format_sql_array(items: list[str]) -> str:
    """Format Python list as PostgreSQL array literal"""
    escaped_items = [f"'{escape_sql_string(item)}'" for item in items]
    return "ARRAY[" + ",".join(escaped_items) + "]"


def make_seed_for_template(template_number: int, document_at_end: str) -> None:
    if document_at_end.lower() not in ["true", "false"]:
        raise ValueError("DOCUMENT_AT_END is string for boolean postgres column true/false")

    template_path = os.path.join(os.path.dirname(__file__), "templates", f"{template_number}.txt")

    with open(template_path, encoding="utf-8") as f:
        txt_content = f.read()

    inserts = extract_inserts(txt_content)
    print(f"Found {len(inserts)} insert placeholders: {inserts}")

    escaped_txt = escape_sql_string(txt_content)
    inserts_array = format_sql_array(inserts)

    timestamp = datetime.now()
    timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")

    sql = f"""UPDATE api.templates
SET txt = '{escaped_txt}',
    inserts = {inserts_array},
    document_at_end = {document_at_end.lower()},
    updated_at = now()
WHERE id = {template_number};"""
    output_path = os.path.join(os.path.dirname(__file__), f"{timestamp_str}.sql")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"Generated SQL seed file: {output_path}")


if __name__ == "__main__":
    make_seed_for_template(TEMPLATE_NUMBER, DOCUMENT_AT_END)

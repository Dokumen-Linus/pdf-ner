import os
import re
from datetime import datetime


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


def make_seed_for_template(template_number: int) -> None:
    template_path = os.path.join(os.path.dirname(__file__), "templates", f"{template_number}.txt")

    with open(template_path, encoding="utf-8") as f:
        txt_content = f.read()

    inserts = extract_inserts(txt_content)
    print(f"Found {len(inserts)} insert placeholders: {inserts}")

    escaped_txt = escape_sql_string(txt_content)
    inserts_array = format_sql_array(inserts)

    sql = f"""INSERT INTO api.templates (txt, inserts, document_at_end) 
VALUES ('{escaped_txt}', {inserts_array}, true);"""

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(os.path.dirname(__file__), f"{timestamp}.sql")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"Generated SQL seed file: {output_path}")


if __name__ == "__main__":
    TEMPLATE_NUMBER = 1

    make_seed_for_template(TEMPLATE_NUMBER)

import logging
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


async def fetch_project(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record | None:
    logger.debug("Fetching project: project_id=%s", project_id)
    return await conn.fetchrow(
        "SELECT id, description FROM web.projects WHERE id = $1",
        project_id,
    )


async def fetch_entity_types(conn: asyncpg.Connection, project_id: UUID) -> list[asyncpg.Record]:
    logger.debug("Fetching entity types: project_id=%s", project_id)
    return await conn.fetch(
        """
        SELECT name, page1_definition, page1_examples, page1_datatype, "unique", "required"
        FROM web.entity_types WHERE project_id = $1
        """,
        project_id,
    )


async def fetch_template(conn: asyncpg.Connection, template_id: int) -> asyncpg.Record | None:
    logger.debug("Fetching template: template_id=%s", template_id)
    return await conn.fetchrow(
        "SELECT id, txt, inserts, document_at_end FROM api.templates WHERE id = $1",
        template_id,
    )


async def fetch_pdf_text(conn: asyncpg.Connection, pdf_id: UUID, project_id: UUID) -> tuple[bool, str | None]:
    """Returns (found, full_text). found=False means no matching row."""
    row = await conn.fetchrow(
        "SELECT full_text FROM workers.pdfs WHERE id = $1 AND project_id = $2",
        pdf_id,
        project_id,
    )
    if row is None:
        return False, None
    return True, row["full_text"]


async def insert_prompt(
    conn: asyncpg.Connection, project_id: UUID, template_id: int, full_text: str
) -> UUID:
    logger.debug("Inserting prompt: project_id=%s, template_id=%s", project_id, template_id)
    prompt_id = await conn.fetchval(
        """
        INSERT INTO api.prompts (project_id, template_id, full_text)
        VALUES ($1, $2, $3) RETURNING id
        """,
        project_id,
        template_id,
        full_text,
    )
    logger.info("Prompt inserted: prompt_id=%s", prompt_id)
    return prompt_id

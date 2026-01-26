from uuid import UUID

import asyncpg

async def fetch_project(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT id, description FROM web.projects WHERE id = $1",
        project_id,
    )


async def fetch_entity_types(conn: asyncpg.Connection, project_id: UUID) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT name, page1_definition, page1_examples, page1_datatype, "unique", "required"
        FROM web.entity_types WHERE project_id = $1
        """,
        project_id,
    )


async def fetch_template(conn: asyncpg.Connection, template_id: int) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT id, txt, inserts, document_at_end FROM api.templates WHERE id = $1",
        template_id,
    )


async def insert_prompt(
    conn: asyncpg.Connection, project_id: UUID, template_id: int, full_text: str
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO api.prompts (project_id, template_id, full_text)
        VALUES ($1, $2, $3) RETURNING id
        """,
        project_id,
        template_id,
        full_text,
    )

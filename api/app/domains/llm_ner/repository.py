from decimal import Decimal
import logging
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


async def fetch_project(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record | None:
    logger.debug("Fetching project: project_id=%s", project_id)
    return await conn.fetchrow(
        """
        SELECT p.id, p.description, p.owner_id, t.organization_id
        FROM web.projects p
        LEFT JOIN web.teams t ON t.id = p.team_id
        WHERE p.id = $1
        """,
        project_id,
    )


async def fetch_available_model(conn: asyncpg.Connection, model: str) -> asyncpg.Record | None:
    logger.debug("Fetching model metadata: model=%s", model)
    return await conn.fetchrow(
        """
        SELECT id, provider, usd_per_1m_input, usd_per_1m_output
        FROM public.models
        WHERE id = $1
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model,
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
        "SELECT id, txt, inserts, document_at_end FROM public.templates WHERE id = $1",
        template_id,
    )


async def fetch_pdf_text(
    conn: asyncpg.Connection, pdf_id: UUID, project_id: UUID
) -> tuple[bool, str | None]:
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


async def record_llm_usage(
    conn: asyncpg.Connection,
    *,
    actor_user_id: UUID | None,
    project_id: UUID,
    billing_user_id: UUID | None,
    billing_organization_id: str | None,
    model: str,
    input_tokens: int,
    output_tokens: int,
    input_cost_usd: Decimal,
    output_cost_usd: Decimal,
) -> None:
    """Insert one API usage record into workers.llm_usage."""
    await conn.execute(
        """
        INSERT INTO workers.llm_usage
            (actor_user_id, project_id, billing_user_id, billing_organization_id,
             model_id, source, input_tokens, output_tokens,
             input_cost_usd, output_cost_usd, cost_usd)
        VALUES ($1, $2, $3, $4, $5, 'api', $6, $7, $8, $9, $10)
        """,
        actor_user_id,
        project_id,
        billing_user_id,
        billing_organization_id,
        model,
        input_tokens,
        output_tokens,
        input_cost_usd,
        output_cost_usd,
        input_cost_usd + output_cost_usd,
    )

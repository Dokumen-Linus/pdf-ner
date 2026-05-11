from decimal import Decimal
import logging
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


async def fetch_model_costs(
    conn: asyncpg.Connection,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> tuple[Decimal, Decimal]:
    row = await conn.fetchrow(
        """
        SELECT usd_per_1m_input, usd_per_1m_output
        FROM public.chat_models
        WHERE id = $1
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model,
    )
    if not row:
        logger.warning("Model not found in public.chat_models: %s - cost recorded as 0", model)
        return Decimal("0"), Decimal("0")

    input_cost = (input_tokens * float(row["usd_per_1m_input"])) / 1_000_000
    output_cost = (output_tokens * float(row["usd_per_1m_output"])) / 1_000_000
    return Decimal(str(round(input_cost, 8))), Decimal(str(round(output_cost, 8)))


async def record_llm_usage(
    conn: asyncpg.Connection,
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
    project_id: UUID,
    actor_user_id: str | None = None,
    task_name: str | None = None,
) -> Decimal:
    input_cost, output_cost = await fetch_model_costs(conn, model, input_tokens, output_tokens)
    total_cost = input_cost + output_cost

    try:
        await conn.execute(
            """
            INSERT INTO workers.llm_usage
                (actor_user_id, project_id, model_id, source, task_name, input_tokens,
                 output_tokens, input_cost_usd, output_cost_usd, cost_usd)
            VALUES ($1, $2, $3, 'worker', $4, $5, $6, $7, $8, $9)
            """,
            actor_user_id,
            project_id,
            model,
            task_name,
            input_tokens,
            output_tokens,
            input_cost,
            output_cost,
            total_cost,
        )
    except Exception:
        logger.exception(
            "Failed to record worker LLM usage: model=%s project=%s in=%d out=%d",
            model,
            project_id,
            input_tokens,
            output_tokens,
        )
    return total_cost

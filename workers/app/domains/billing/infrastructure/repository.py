from decimal import Decimal
import logging
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


async def fetch_model_cost(
    conn: asyncpg.Connection,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> Decimal:
    """Look up model pricing from public.models and compute cost in USD.

    Falls back to 0 with a warning if the model is not in the table or has ended.
    """
    row = await conn.fetchrow(
        """
        SELECT usd_per_1m_input, usd_per_1m_output
        FROM public.models
        WHERE id = $1
          AND (end_available_date IS NULL OR end_available_date > now())
        """,
        model,
    )
    if not row:
        logger.warning("Model not found in public.models: %s — cost recorded as 0", model)
        return Decimal("0")

    cost = (
        input_tokens * float(row["usd_per_1m_input"])
        + output_tokens * float(row["usd_per_1m_output"])
    ) / 1_000_000
    return Decimal(str(round(cost, 8)))


async def record_llm_usage(
    conn: asyncpg.Connection,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    project_id: UUID | None = None,
    user_id: UUID | None = None,
    task_name: str | None = None,
) -> None:
    """Insert a usage record into workers.llm_usage with DB-sourced cost."""
    cost = await fetch_model_cost(conn, model, input_tokens, output_tokens)
    try:
        await conn.execute(
            """
            INSERT INTO workers.llm_usage
                (user_id, project_id, provider, model, source, task_name,
                 input_tokens, output_tokens, cost_usd)
            VALUES ($1, $2, $3, $4, 'worker', $5, $6, $7, $8)
            """,
            user_id,
            project_id,
            provider,
            model,
            task_name,
            input_tokens,
            output_tokens,
            cost,
        )
    except Exception:
        logger.exception(
            "Failed to record worker LLM usage: provider=%s model=%s in=%d out=%d",
            provider,
            model,
            input_tokens,
            output_tokens,
        )


async def get_unreported_batches(conn: asyncpg.Connection, limit: int = 500):
    """Fetch unreported usage batches grouped by user + subscription item."""
    return await conn.fetch(
        """
        SELECT
            u.user_id,
            sc.stripe_subscription_item_id,
            ARRAY_AGG(u.id)                          AS usage_ids,
            COALESCE(SUM(u.cost_usd), 0)             AS total_cost_usd,
            COALESCE(SUM(u.input_tokens), 0)::bigint  AS total_input_tokens,
            COALESCE(SUM(u.output_tokens), 0)::bigint AS total_output_tokens
        FROM workers.llm_usage u
        JOIN workers.stripe_customers sc ON sc.user_id = u.user_id
        WHERE u.stripe_reported = FALSE
          AND sc.stripe_subscription_item_id IS NOT NULL
        GROUP BY u.user_id, sc.stripe_subscription_item_id
        LIMIT $1
        """,
        limit,
    )


async def mark_reported(
    conn: asyncpg.Connection,
    usage_ids: list,
    event_id: str,
) -> None:
    """Flag usage rows as reported to Stripe."""
    await conn.execute(
        """
        UPDATE workers.llm_usage
        SET stripe_reported = TRUE, stripe_usage_event_id = $2
        WHERE id = ANY($1::uuid[])
        """,
        usage_ids,
        event_id,
    )

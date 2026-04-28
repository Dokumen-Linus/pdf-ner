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
    """Look up model pricing from public.models and compute input/output USD snapshots."""
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
        logger.warning("Model not found in public.models: %s - cost recorded as 0", model)
        return Decimal("0"), Decimal("0")

    input_cost = (input_tokens * float(row["usd_per_1m_input"])) / 1_000_000
    output_cost = (output_tokens * float(row["usd_per_1m_output"])) / 1_000_000
    return Decimal(str(round(input_cost, 8))), Decimal(str(round(output_cost, 8)))


async def fetch_project_billing_target(
    conn: asyncpg.Connection,
    project_id: UUID,
) -> asyncpg.Record:
    row = await conn.fetchrow(
        """
        SELECT p.owner_id, t.organization_id
        FROM web.projects p
        LEFT JOIN web.teams t ON t.id = p.team_id
        WHERE p.id = $1
        """,
        project_id,
    )
    if not row:
        raise ValueError(f"Project not found: {project_id}")
    return row


async def record_llm_usage(
    conn: asyncpg.Connection,
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
    project_id: UUID,
    actor_user_id: UUID | None = None,
    task_name: str | None = None,
) -> Decimal:
    """Insert one billable LLM usage event. Stripe reporting is batch-only."""
    input_cost, output_cost = await fetch_model_costs(conn, model, input_tokens, output_tokens)
    total_cost = input_cost + output_cost
    target = await fetch_project_billing_target(conn, project_id)
    billing_organization_id = target["organization_id"]
    billing_user_id = None if billing_organization_id else target["owner_id"]

    try:
        await conn.execute(
            """
            INSERT INTO workers.llm_usage
                (actor_user_id, project_id, billing_user_id, billing_organization_id,
                 model_id, source, task_name, input_tokens, output_tokens,
                 input_cost_usd, output_cost_usd, cost_usd)
            VALUES ($1, $2, $3, $4, $5, 'worker', $6, $7, $8, $9, $10, $11)
            """,
            actor_user_id,
            project_id,
            billing_user_id,
            billing_organization_id,
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


async def get_unreported_batches(
    conn: asyncpg.Connection,
    *,
    project_id: UUID | None = None,
    limit: int = 5000,
):
    """Fetch unreported usage grouped by billing target + Stripe customer."""
    project_filter = "AND u.project_id = $2" if project_id is not None else ""
    args = [limit]
    if project_id is not None:
        args.append(project_id)

    return await conn.fetch(
        f"""
        SELECT
            u.billing_user_id,
            u.billing_organization_id,
            COALESCE(wu.stripe_customer_id, wo.stripe_customer_id) AS stripe_customer_id,
            ARRAY_AGG(u.id ORDER BY u.created_at) AS usage_ids,
            MIN(u.created_at) AS period_start,
            MAX(u.created_at) AS period_end,
            COUNT(*)::int AS usage_count,
            COALESCE(SUM(u.cost_usd), 0) AS total_cost_usd,
            COALESCE(SUM(u.input_tokens), 0)::bigint AS total_input_tokens,
            COALESCE(SUM(u.output_tokens), 0)::bigint AS total_output_tokens
        FROM workers.llm_usage u
        LEFT JOIN web.users wu ON wu.id = u.billing_user_id
        LEFT JOIN web.organizations wo ON wo.id = u.billing_organization_id
        WHERE u.report_batch_id IS NULL
          {project_filter}
          AND COALESCE(wu.stripe_customer_id, wo.stripe_customer_id) IS NOT NULL
        GROUP BY u.billing_user_id, u.billing_organization_id, stripe_customer_id
        ORDER BY period_start
        LIMIT $1
        """,
        *args,
    )


async def create_report_batch_and_link_usage(
    conn: asyncpg.Connection,
    *,
    batch: asyncpg.Record,
    stripe_meter_event_identifier: str,
) -> UUID:
    async with conn.transaction():
        batch_id = await conn.fetchval(
            """
            INSERT INTO workers.llm_usage_report_batches
                (billing_user_id, billing_organization_id, period_start, period_end,
                 usage_count, input_tokens, output_tokens, cost_usd,
                 stripe_meter_event_identifier, status, reported_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'reported', now())
            RETURNING id
            """,
            batch["billing_user_id"],
            batch["billing_organization_id"],
            batch["period_start"],
            batch["period_end"],
            batch["usage_count"],
            batch["total_input_tokens"],
            batch["total_output_tokens"],
            batch["total_cost_usd"],
            stripe_meter_event_identifier,
        )
        await conn.execute(
            """
            UPDATE workers.llm_usage
            SET report_batch_id = $2
            WHERE id = ANY($1::uuid[])
              AND report_batch_id IS NULL
            """,
            list(batch["usage_ids"]),
            batch_id,
        )
        return batch_id

from uuid import UUID

import asyncpg


async def get_usage_summary(
    conn: asyncpg.Connection,
    user_id: UUID,
    days: int = 30,
) -> dict:
    row = await conn.fetchrow(
        """
        SELECT
            COUNT(*)::int                           AS call_count,
            COALESCE(SUM(input_tokens), 0)::bigint  AS total_input_tokens,
            COALESCE(SUM(output_tokens), 0)::bigint AS total_output_tokens,
            COALESCE(SUM(cost_usd), 0)              AS total_cost_usd
        FROM workers.llm_usage
        WHERE user_id = $1
          AND created_at >= now() - ($2 || ' days')::interval
        """,
        user_id,
        str(days),
    )
    return dict(row) if row else {}


async def get_usage_by_model(
    conn: asyncpg.Connection,
    user_id: UUID,
    days: int = 30,
) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT
            provider,
            model,
            COUNT(*)::int                           AS call_count,
            COALESCE(SUM(input_tokens), 0)::bigint  AS input_tokens,
            COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
            COALESCE(SUM(cost_usd), 0)              AS cost_usd
        FROM workers.llm_usage
        WHERE user_id = $1
          AND created_at >= now() - ($2 || ' days')::interval
        GROUP BY provider, model
        ORDER BY cost_usd DESC
        """,
        user_id,
        str(days),
    )


async def get_usage_by_day(
    conn: asyncpg.Connection,
    user_id: UUID,
    days: int = 30,
) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
            COUNT(*)::int                                          AS call_count,
            COALESCE(SUM(input_tokens), 0)::bigint                AS input_tokens,
            COALESCE(SUM(output_tokens), 0)::bigint               AS output_tokens,
            COALESCE(SUM(cost_usd), 0)                            AS cost_usd
        FROM workers.llm_usage
        WHERE user_id = $1
          AND created_at >= now() - ($2 || ' days')::interval
        GROUP BY 1
        ORDER BY 1
        """,
        user_id,
        str(days),
    )


async def get_stripe_customer(
    conn: asyncpg.Connection,
    user_id: UUID,
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT * FROM workers.stripe_customers WHERE user_id = $1",
        user_id,
    )


async def upsert_stripe_customer(
    conn: asyncpg.Connection,
    user_id: UUID,
    stripe_customer_id: str,
) -> None:
    await conn.execute(
        """
        INSERT INTO workers.stripe_customers (user_id, stripe_customer_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id,
                                            updated_at = now()
        """,
        user_id,
        stripe_customer_id,
    )


async def update_stripe_subscription(
    conn: asyncpg.Connection,
    user_id: UUID,
    subscription_id: str | None,
    subscription_item_id: str | None,
) -> None:
    await conn.execute(
        """
        UPDATE workers.stripe_customers
        SET stripe_subscription_id = $2,
            stripe_subscription_item_id = $3,
            updated_at = now()
        WHERE user_id = $1
        """,
        user_id,
        subscription_id,
        subscription_item_id,
    )


async def get_unreported_usage(
    conn: asyncpg.Connection,
    limit: int = 1000,
) -> list[asyncpg.Record]:
    """Fetch unreported usage records grouped by user, for Stripe reporting."""
    return await conn.fetch(
        """
        SELECT
            u.user_id,
            sc.stripe_customer_id,
            sc.stripe_subscription_item_id,
            ARRAY_AGG(u.id)                         AS usage_ids,
            COALESCE(SUM(u.cost_usd), 0)            AS total_cost_usd,
            COALESCE(SUM(u.input_tokens), 0)::bigint AS total_input_tokens,
            COALESCE(SUM(u.output_tokens), 0)::bigint AS total_output_tokens
        FROM workers.llm_usage u
        JOIN workers.stripe_customers sc ON sc.user_id = u.user_id
        WHERE u.stripe_reported = FALSE
          AND sc.stripe_subscription_item_id IS NOT NULL
        GROUP BY u.user_id, sc.stripe_customer_id, sc.stripe_subscription_item_id
        LIMIT $1
        """,
        limit,
    )


async def mark_usage_reported(
    conn: asyncpg.Connection,
    usage_ids: list[UUID],
    event_id: str,
) -> None:
    await conn.execute(
        """
        UPDATE workers.llm_usage
        SET stripe_reported = TRUE, stripe_usage_event_id = $2
        WHERE id = ANY($1::uuid[])
        """,
        usage_ids,
        event_id,
    )

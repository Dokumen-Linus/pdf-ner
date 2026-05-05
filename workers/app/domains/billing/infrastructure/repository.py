from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

import asyncpg

BASE_PRICE_CENTS = 1000


def usd_to_cents(value: Decimal) -> int:
    return int((value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


async def fetch_due_individuals(conn: asyncpg.Connection, *, limit: int) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT id, stripe_customer_id, stripe_payment_method_id, billing_failure_count,
               billing_started_at, last_payment_at, next_payment_at
        FROM web.users
        WHERE role = 'individual'
          AND billing_status IN ('active', 'past_due')
          AND stripe_customer_id IS NOT NULL
          AND stripe_payment_method_id IS NOT NULL
          AND next_payment_at <= now()
        ORDER BY next_payment_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        """,
        limit,
    )


async def fetch_due_organizations(conn: asyncpg.Connection, *, limit: int) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT id, n_users, stripe_customer_id, stripe_payment_method_id, billing_failure_count,
               billing_started_at, last_payment_at, next_payment_at
        FROM web.organizations
        WHERE billing_status IN ('active', 'past_due')
          AND stripe_customer_id IS NOT NULL
          AND stripe_payment_method_id IS NOT NULL
          AND next_payment_at <= now()
        ORDER BY next_payment_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        """,
        limit,
    )


async def sum_individual_usage(
    conn: asyncpg.Connection,
    *,
    user_id: UUID,
    period_start,
    period_end,
) -> asyncpg.Record:
    return await conn.fetchrow(
        """
        SELECT COALESCE(SUM(u.cost_usd), 0) AS usage_cost_usd,
               COUNT(u.id)::int AS llm_usage_count
        FROM workers.llm_usage u
        INNER JOIN web.projects p ON p.id = u.project_id
        WHERE p.owner_id = $1
          AND p.team_id IS NULL
          AND u.created_at >= $2
          AND u.created_at < $3
        """,
        user_id,
        period_start,
        period_end,
    )


async def sum_organization_usage(
    conn: asyncpg.Connection,
    *,
    organization_id: str,
    period_start,
    period_end,
) -> asyncpg.Record:
    return await conn.fetchrow(
        """
        SELECT COALESCE(SUM(u.cost_usd), 0) AS usage_cost_usd,
               COUNT(u.id)::int AS llm_usage_count
        FROM workers.llm_usage u
        INNER JOIN web.projects p ON p.id = u.project_id
        INNER JOIN web.teams t ON t.id = p.team_id
        WHERE t.organization_id = $1
          AND u.created_at >= $2
          AND u.created_at < $3
        """,
        organization_id,
        period_start,
        period_end,
    )


async def create_charge_attempt(
    conn: asyncpg.Connection,
    *,
    account_type: str,
    account_id: str,
    period_start,
    period_end,
    base_amount_cents: int,
    usage_cost_usd: Decimal,
    llm_usage_count: int,
    stripe_customer_id: str,
    stripe_payment_method_id: str,
    idempotency_key: str,
) -> asyncpg.Record:
    usage_amount_cents = usd_to_cents(usage_cost_usd)
    total_amount_cents = base_amount_cents + usage_amount_cents
    return await conn.fetchrow(
        """
        INSERT INTO workers.billing_charge_attempts
            (account_type, user_id, organization_id, period_start, period_end,
             base_amount_cents, usage_amount_cents, total_amount_cents, usage_cost_usd,
             llm_usage_count, stripe_customer_id, stripe_payment_method_id, idempotency_key)
        VALUES ($1, CASE WHEN $1 = 'individual' THEN $2::uuid ELSE NULL END,
                CASE WHEN $1 = 'organization' THEN $2::text ELSE NULL END,
                $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (idempotency_key) DO UPDATE
        SET idempotency_key = EXCLUDED.idempotency_key
        RETURNING id, total_amount_cents, status
        """,
        account_type,
        account_id,
        period_start,
        period_end,
        base_amount_cents,
        usage_amount_cents,
        total_amount_cents,
        usage_cost_usd,
        llm_usage_count,
        stripe_customer_id,
        stripe_payment_method_id,
        idempotency_key,
    )


async def mark_charge_success(
    conn: asyncpg.Connection,
    *,
    attempt_id: UUID,
    account_type: str,
    account_id: str,
    period_end,
    payment_intent_id: str,
) -> None:
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE workers.billing_charge_attempts
            SET status = 'succeeded', stripe_payment_intent_id = $2, charged_at = now()
            WHERE id = $1
            """,
            attempt_id,
            payment_intent_id,
        )
        if account_type == "individual":
            await conn.execute(
                """
                UPDATE web.users
                SET billing_status = 'active',
                    billing_failure_count = 0,
                    last_payment_at = now(),
                    next_payment_at = $2::timestamptz + interval '1 month',
                    updated_at = now()
                WHERE id = $1::uuid
                """,
                account_id,
                period_end,
            )
        else:
            await conn.execute(
                """
                UPDATE web.organizations
                SET billing_status = 'active',
                    billing_failure_count = 0,
                    last_payment_at = now(),
                    next_payment_at = $2::timestamptz + interval '1 month',
                    updated_at = now()
                WHERE id = $1
                """,
                account_id,
                period_end,
            )


async def mark_charge_failure(
    conn: asyncpg.Connection,
    *,
    attempt_id: UUID,
    account_type: str,
    account_id: str,
    error_message: str,
    retry_after,
) -> None:
    async with conn.transaction():
        await conn.execute(
            """
            UPDATE workers.billing_charge_attempts
            SET status = 'failed', error_message = $2, retry_after = $3
            WHERE id = $1
            """,
            attempt_id,
            error_message[:1000],
            retry_after,
        )
        if account_type == "individual":
            await conn.execute(
                """
                UPDATE web.users
                SET billing_status = 'past_due',
                    billing_failure_count = billing_failure_count + 1,
                    updated_at = now()
                WHERE id = $1::uuid
                """,
                account_id,
            )
        else:
            await conn.execute(
                """
                UPDATE web.organizations
                SET billing_status = 'past_due',
                    billing_failure_count = billing_failure_count + 1,
                    updated_at = now()
                WHERE id = $1
                """,
                account_id,
            )

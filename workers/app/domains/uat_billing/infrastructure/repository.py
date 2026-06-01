from __future__ import annotations

import asyncpg


async def fetch_billing_account(
    conn: asyncpg.Connection,
    *,
    account_type: str,
    account_id: str,
) -> asyncpg.Record | None:
    if account_type == "individual":
        return await conn.fetchrow(
            """
            SELECT id, stripe_customer_id, stripe_payment_method_id, billing_failure_count,
                   billing_started_at, last_payment_at, next_payment_at
            FROM web.users
            WHERE id = $1
              AND role = 'individual'
              AND billing_status IN ('active', 'past_due')
              AND stripe_customer_id IS NOT NULL
              AND stripe_payment_method_id IS NOT NULL
            FOR UPDATE
            """,
            account_id,
        )

    if account_type == "organization":
        return await conn.fetchrow(
            """
            SELECT o.id,
                   GREATEST(COUNT(m.id)::int, 1) AS member_count,
                   o.stripe_customer_id,
                   o.stripe_payment_method_id,
                   o.billing_failure_count,
                   o.billing_started_at,
                   o.last_payment_at,
                   o.next_payment_at
            FROM web.organizations o
            LEFT JOIN auth.member m ON m."organizationId" = o.id
            WHERE o.id = $1
              AND o.billing_status IN ('active', 'past_due')
              AND o.stripe_customer_id IS NOT NULL
              AND o.stripe_payment_method_id IS NOT NULL
            GROUP BY o.id
            FOR UPDATE
            """,
            account_id,
        )

    raise ValueError("account_type must be individual or organization")

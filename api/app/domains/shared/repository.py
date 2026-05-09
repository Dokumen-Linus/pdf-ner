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


async def fetch_bucket_by_id(conn: asyncpg.Connection, bucket_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT id, name, region, endpoint_url FROM api.aws_buckets WHERE id = $1",
        bucket_id,
    )

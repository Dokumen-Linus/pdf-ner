from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.domains.billing.infrastructure.repository import record_llm_usage


@pytest.mark.anyio
async def test_record_llm_usage_inserts_model_without_provider():
    project_id = uuid4()
    owner_id = uuid4()
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        side_effect=[
            {"usd_per_1m_input": 2.5, "usd_per_1m_output": 10},
            {"owner_id": owner_id, "organization_id": None},
        ]
    )
    conn.execute = AsyncMock()

    cost = await record_llm_usage(
        conn,
        model="gpt-4o",
        input_tokens=100,
        output_tokens=50,
        project_id=project_id,
        task_name="test.task",
    )

    insert_sql = conn.execute.await_args.args[0]
    assert "provider" not in insert_sql
    assert "model_id" in insert_sql
    assert cost == Decimal("0.00075")

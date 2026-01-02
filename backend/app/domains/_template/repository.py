from uuid import UUID
from asyncpg import Pool

class TemplateRepository:
    def __init__(self, pool: Pool):
        self.pool = pool

    async def get_row(self, id: UUID) -> str:
        query = """
        SELECT *
        FROM table
        WHERE id = $1
        """

        row = await self.pool.fetchrow(query, id)
        if not row:
            raise ValueError("Row not found")

        return row

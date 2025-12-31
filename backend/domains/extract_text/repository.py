from uuid import UUID
from asyncpg import Pool

class PDFRepository:
    def __init__(self, pool: Pool):
        self.pool = pool

    async def get_s3_key(self, pdf_id: UUID) -> str:
        query = """
        SELECT filename
        FROM pdfs
        WHERE id = $1
        """

        row = await self.pool.fetchrow(query, pdf_id)
        if not row:
            raise ValueError("PDF not found")

        return row["s3_key"]

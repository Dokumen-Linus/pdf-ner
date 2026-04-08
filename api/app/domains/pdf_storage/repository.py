from uuid import UUID

import asyncpg


async def insert_bucket(
    conn: asyncpg.Connection,
    name: str,
    region: str,
    access_key_id: str,
    secret_access_key: str,
    endpoint_url: str | None,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO public.aws_buckets (name, region, access_key_id, secret_access_key, endpoint_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
        name, region, access_key_id, secret_access_key, endpoint_url,
    )


async def insert_pdf(
    conn: asyncpg.Connection,
    project_id: UUID,
    bucket_id: UUID,
    filepath: str,
    name: str,
) -> UUID:
    pdf_id = await conn.fetchval(
        """
        INSERT INTO workers.pdfs (project_id, bucket_id, filepath, name)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        project_id, bucket_id, filepath, name,
    )
    await conn.execute("INSERT INTO web.pdfs (id) VALUES ($1)", pdf_id)
    await conn.execute("INSERT INTO api.pdfs (id) VALUES ($1)", pdf_id)
    return pdf_id


async def delete_bucket(conn: asyncpg.Connection, bucket_id: UUID) -> None:
    await conn.execute("DELETE FROM public.aws_buckets WHERE id = $1", bucket_id)


async def delete_pdf(conn: asyncpg.Connection, pdf_id: UUID) -> None:
    """Delete PDF and its cross-schema records."""
    await conn.execute("DELETE FROM api.pdfs WHERE id = $1", pdf_id)
    await conn.execute("DELETE FROM web.pdfs WHERE id = $1", pdf_id)
    await conn.execute("DELETE FROM workers.pdfs WHERE id = $1", pdf_id)

from uuid import UUID

import asyncpg


async def insert_bucket(
    conn: asyncpg.Connection,
    name: str,
    region: str,
    endpoint_url: str | None,
    owner_user_id: str | None,
    owner_org_id: str | None,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO api.aws_buckets (name, region, endpoint_url, owner_user_id, owner_org_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
        name,
        region,
        endpoint_url,
        owner_user_id,
        owner_org_id,
    )


async def insert_pdf(
    conn: asyncpg.Connection,
    project_id: UUID,
    filepath: str,
    uploaded_by_user_id: str | None,
) -> UUID:
    pdf_id = await conn.fetchval(
        """
        INSERT INTO core.pdfs (project_id, filepath, source_type, uploaded_by_user_id)
        VALUES ($1, $2, 'upload', $3)
        RETURNING id
        """,
        project_id,
        filepath,
        uploaded_by_user_id,
    )
    await conn.execute("INSERT INTO web.pdfs (id) VALUES ($1)", pdf_id)
    return pdf_id


async def fetch_pdf_by_id(conn: asyncpg.Connection, pdf_id: UUID) -> asyncpg.Record | None:
    """Return the core PDF row plus owner context needed for URL authz."""
    return await conn.fetchrow(
        """
        SELECT p.id, pr.bucket_id, p.filepath, p.project_id, pr.owner_user_id
        FROM core.pdfs AS p
        INNER JOIN web.projects AS pr ON pr.id = p.project_id
        WHERE p.id = $1
        """,
        pdf_id,
    )


async def delete_bucket(conn: asyncpg.Connection, bucket_id: UUID) -> None:
    await conn.execute("DELETE FROM api.aws_buckets WHERE id = $1", bucket_id)


async def delete_pdf(conn: asyncpg.Connection, pdf_id: UUID) -> None:
    """Delete PDF and its cross-schema records."""
    await conn.execute("DELETE FROM web.pdfs WHERE id = $1", pdf_id)
    await conn.execute("DELETE FROM core.pdfs WHERE id = $1", pdf_id)

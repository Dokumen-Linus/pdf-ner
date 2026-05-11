from __future__ import annotations

import json
from uuid import UUID

import asyncpg

from ..application.schemas import DiscoveredDocumentPayload, MaterializedDocumentPayload


def _require_uuid_config(config: dict, key: str) -> UUID:
    value = config.get(key)
    if isinstance(value, UUID):
        return value
    if isinstance(value, str) and value:
        return UUID(value)
    raise ValueError(f"Missing source provider config UUID value '{key}'")


def _filepath_for_document(
    connection: dict,
    document: DiscoveredDocumentPayload,
    config: dict,
) -> str:
    prefix = config.get("filepath_prefix")
    safe_prefix = prefix.strip("/") if isinstance(prefix, str) and prefix.strip("/") else "sources"
    name = document.name or f"{document.external_id}.pdf"
    safe_name = name.replace("/", "_").replace("\\", "_").strip() or "document.pdf"
    return f"{connection['project_id']}/{safe_prefix}/{connection['id']}/{document.external_id}/{safe_name}"


class PostgresDocumentMaterializer:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def materialize(
        self,
        connection: dict,
        document: DiscoveredDocumentPayload,
    ) -> MaterializedDocumentPayload:
        existing = await self.conn.fetchrow(
            """
            SELECT s.id, p.id AS pdf_id
            FROM core.sources s
            LEFT JOIN core.pdfs p ON p.source_id = s.id
            WHERE s.source_connection_id = $1
              AND external_id = $2
              AND external_version = $3
            """,
            connection.get("source_connection_id", connection["id"]),
            document.external_id,
            document.external_version,
        )
        if existing is not None:
            return MaterializedDocumentPayload(
                source_id=existing["id"],
                pdf_id=existing["pdf_id"],
                is_new=False,
            )

        config = connection.get("config") or {}
        filepath = _filepath_for_document(connection, document, config)
        metadata = {
            **document.metadata,
            "source_uri": document.uri,
            "source_fingerprint": document.fingerprint,
        }

        async with self.conn.transaction():
            source_id = await self.conn.fetchval(
                """
                INSERT INTO core.sources
                    (source_connection_id, external_id, external_version, uri, fingerprint,
                     name, status, metadata, last_queued_at)
                VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7::jsonb, now())
                RETURNING id
                """,
                connection.get("source_connection_id", connection["id"]),
                document.external_id,
                document.external_version,
                document.uri,
                document.fingerprint,
                document.name,
                json.dumps(metadata),
            )
            pdf_id = await self.conn.fetchval(
                """
                INSERT INTO core.pdfs
                    (project_id, filepath, source_type, source_id, ner_workflow_id,
                     watcher_id, watcher_run_id)
                VALUES ($1, $2, 'watcher', $3, $4, $5, $6)
                RETURNING id
                """,
                connection["project_id"],
                filepath,
                source_id,
                connection.get("ner_workflow_id"),
                connection["id"],
                connection.get("watcher_run_id"),
            )

        return MaterializedDocumentPayload(
            source_id=source_id,
            pdf_id=pdf_id,
            is_new=True,
        )

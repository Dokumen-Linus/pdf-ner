from __future__ import annotations

import json
from typing import Any, cast
from uuid import UUID

import asyncpg

from app.shared.domain.prompts import PromptEntityMetadata, form_prompt_text


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _as_list(value: Any) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    return []


async def fetch_prompt_render_inputs(
    conn: asyncpg.Connection,
    prompt_id: UUID,
    project_id: UUID,
) -> tuple[str, str | None, list[PromptEntityMetadata]]:
    prompt = await conn.fetchrow(
        """
        SELECT p.id,
               p.project_id,
               p.template_id,
               p.project_description,
               p.entity_types_order,
               p.entity_type_definitions,
               p.entity_type_example_values,
               p.entity_type_example_finds,
               t.txt AS template_text,
               pr.description AS current_project_description
        FROM core.prompts p
        JOIN public.templates t ON t.id = p.template_id
        JOIN web.projects pr ON pr.id = p.project_id
        WHERE p.id = $1
          AND p.project_id = $2
        """,
        prompt_id,
        project_id,
    )
    if prompt is None:
        raise ValueError(f"Prompt not found for project: prompt={prompt_id}, project={project_id}")

    entity_types_order = _as_list(prompt["entity_types_order"])
    if not entity_types_order:
        raise ValueError(f"Prompt has no entity type order: {prompt_id}")

    rows = await conn.fetch(
        """
        SELECT
            et.id AS entity_type_id,
            et.name,
            et.user_definition,
            et.user_example_values,
            et.required,
            et."unique",
            COALESCE(et.regex, s.regex) AS regex,
            s.definition AS std_definition,
            s.examples AS std_examples
        FROM web.entity_types et
        LEFT JOIN public.std_entity_types s ON s.id = et.standard_entity_type_id
        WHERE et.project_id = $1
          AND et.id = ANY($2::uuid[])
        """,
        project_id,
        entity_types_order,
    )
    entity_by_id = {cast(UUID, row["entity_type_id"]): row for row in rows}
    missing_ids = [entity_id for entity_id in entity_types_order if entity_id not in entity_by_id]
    if missing_ids:
        raise ValueError(f"Prompt references missing entity types: {missing_ids}")

    definitions = _as_dict(prompt["entity_type_definitions"])
    example_values = _as_dict(prompt["entity_type_example_values"])
    example_finds = _as_dict(prompt["entity_type_example_finds"])

    entities: list[PromptEntityMetadata] = []
    for entity_id in entity_types_order:
        row = entity_by_id[entity_id]
        key = str(entity_id)
        entities.append(
            PromptEntityMetadata(
                entity_type_id=entity_id,
                name=row["name"],
                definition=definitions.get(key) or row["user_definition"] or row["std_definition"],
                example_values=list(
                    example_values.get(key)
                    or row["user_example_values"]
                    or row["std_examples"]
                    or []
                ),
                example_finds=list(example_finds.get(key) or []),
                regex=row["regex"],
                required=bool(row["required"]),
                unique=bool(row["unique"]),
            )
        )

    return (
        prompt["template_text"],
        prompt["project_description"] or prompt["current_project_description"],
        entities,
    )


async def ensure_prompt_full_text(
    conn: asyncpg.Connection,
    prompt_id: UUID,
    project_id: UUID,
) -> str:
    existing = await conn.fetchval(
        """
        SELECT full_text
        FROM core.prompts
        WHERE id = $1
          AND project_id = $2
        """,
        prompt_id,
        project_id,
    )
    if existing:
        return cast(str, existing)

    template_text, project_description, entity_types = await fetch_prompt_render_inputs(
        conn,
        prompt_id,
        project_id,
    )
    full_text = form_prompt_text(
        template_text,
        project_description=project_description,
        entity_types=entity_types,
    )
    result = await conn.execute(
        """
        UPDATE core.prompts
        SET full_text = $3
        WHERE id = $1
          AND project_id = $2
          AND full_text IS NULL
        """,
        prompt_id,
        project_id,
        full_text,
    )
    if result == "UPDATE 0":
        existing = await conn.fetchval(
            "SELECT full_text FROM core.prompts WHERE id = $1 AND project_id = $2",
            prompt_id,
            project_id,
        )
        if existing:
            return cast(str, existing)
    return full_text

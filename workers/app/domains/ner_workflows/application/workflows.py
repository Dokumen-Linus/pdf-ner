from __future__ import annotations

import json
from typing import Any

import asyncpg

from app.domains.llm_usage.infrastructure.repository import record_llm_usage
from app.integrations.anthropic import call_anthropic
from app.integrations.gemini import call_google_genai
from app.integrations.openai import call_openai
from app.shared.domain.LLMResponseData import LLMResponseData
from app.shared.infrastructure.s3 import download_pdf_bytes

from ..domain import services
from ..domain.value_objects import PageText, has_usable_text, join_page_text
from ..infrastructure import ocr
from ..infrastructure import repositories as repo
from .commands import ProcessDocumentSource

_TASK_NAME = "ner_workflows.process_document_source"
_SUPPORTED_PROVIDERS = {"openai", "anthropic", "gemini"}


def _report_progress(
    task: Any | None,
    phase: str,
    message: str,
    percent: int,
    **details: Any,
) -> None:
    if task is None:
        return
    task.update_state(
        state="PROGRESS",
        meta={"phase": phase, "message": message, "percent": percent, "details": details},
    )


def _text_by_page_payload(pages: list[PageText]) -> dict:
    return {"pages": [{"page_index": page.page_index, "text": page.text} for page in pages]}


def _append_json_schema_instruction(system_prompt: str, schema: dict) -> str:
    return (
        f"{system_prompt}\n\n"
        "Return only valid JSON that matches this JSON Schema:\n"
        f"{json.dumps(schema, sort_keys=True)}"
    )


async def _call_llm_for_model(
    clients: dict[str, Any],
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema: dict,
) -> LLMResponseData:
    if provider == "openai":
        return await call_openai(
            clients["openai"],
            model,
            system_prompt,
            user_prompt,
            schema=schema,
            schema_name="ner_workflows",
        )
    if provider == "anthropic":
        return await call_anthropic(
            clients["anthropic"],
            model,
            _append_json_schema_instruction(system_prompt, schema),
            user_prompt,
        )
    if provider == "gemini":
        return await call_google_genai(
            clients["gemini"],
            model,
            _append_json_schema_instruction(system_prompt, schema),
            user_prompt,
            json_response=True,
        )
    raise ValueError(f"Unsupported model provider: {provider}")


async def process_document_source_workflow(
    conn: asyncpg.Connection,
    llm_clients: dict[str, Any],
    cmd: ProcessDocumentSource,
    task: Any | None = None,
) -> dict:
    document = await repo.fetch_document_for_extraction(conn, cmd.source_id)
    if document is None:
        raise LookupError(f"Source not found: {cmd.source_id}")

    project = await repo.fetch_project_config(conn, document.project_id)
    if project is None:
        raise LookupError(f"Project not found: {document.project_id}")

    model_metadata = await repo.fetch_available_model_metadata(
        conn, project.entity_extraction_model
    )
    if model_metadata is None:
        raise ValueError(f"Model is not available: {project.entity_extraction_model}")
    if model_metadata.provider not in _SUPPORTED_PROVIDERS:
        raise ValueError(f"Unsupported model provider: {model_metadata.provider}")

    optimized_prompt = await repo.fetch_optimized_prompt(
        conn, project.active_prompt_id, document.project_id
    )
    if optimized_prompt is None:
        raise ValueError("Active prompt not found for document project")

    entity_types = await repo.fetch_entity_types(conn, document.project_id)
    if not entity_types:
        raise ValueError(f"No entity types for project: {document.project_id}")

    run_id = await repo.insert_run(
        conn,
        project_id=document.project_id,
        prompt_id=project.active_prompt_id,
        ner_workflow_id=document.ner_workflow_id,
    )

    try:
        _report_progress(task, "text", "Extracting document text", 15)
        full_text, text_by_page, extract_method, pdf_txt_id = await _ensure_text(
            conn, document, project.ocr_method
        )
        await repo.insert_run_pdf(
            conn, ner_run_id=run_id, pdf_id=document.pdf_id, pdf_txt_id=pdf_txt_id
        )

        _report_progress(
            task, "ner", "Extracting entities", 65, model=project.entity_extraction_model
        )
        schema = services.build_json_schema(entity_types)
        system_prompt = optimized_prompt or services.build_fallback_system_prompt(
            project, entity_types
        )
        llm_usage: LLMResponseData = await _call_llm_for_model(
            llm_clients,
            model_metadata.provider,
            project.entity_extraction_model,
            system_prompt,
            full_text,
            schema,
        )
        extracted = json.loads(llm_usage.text)
        await record_llm_usage(
            conn,
            model=project.entity_extraction_model,
            input_tokens=llm_usage.input_tokens,
            output_tokens=llm_usage.output_tokens,
            project_id=document.project_id,
            task_name=_TASK_NAME,
        )

        _report_progress(task, "persist", "Saving extracted entities", 90)
        await repo.complete_run_and_pdf(
            conn,
            run_id=run_id,
            pdf_id=document.pdf_id,
            source_id=document.source_id,
            extracted=extracted,
            entity_types=entity_types,
        )
        return {
            "run_id": str(run_id),
            "source_id": str(document.source_id),
            "pdf_id": str(document.pdf_id),
            "extract_method": extract_method,
            "model": project.entity_extraction_model,
        }
    except Exception as exc:
        await repo.fail_run(
            conn,
            source_id=document.source_id,
            error_type=type(exc).__name__,
            error_message=str(exc),
        )
        raise


async def _ensure_text(
    conn: asyncpg.Connection,
    document,
    ocr_method: str,
) -> tuple[str, dict, str, object | None]:
    if has_usable_text(document.full_text):
        return (
            document.full_text or "",
            {"pages": [{"page_index": 0, "text": document.full_text}]},
            "metadata",
            None,
        )

    pdf_bytes, _filepath = await download_pdf_bytes(conn, document.pdf_id)
    pages = await ocr.extract_pdfium_pages(pdf_bytes)
    full_text = join_page_text(pages)
    if has_usable_text(full_text):
        payload = _text_by_page_payload(pages)
        pdf_txt_id = await repo.update_pdf_text(
            conn,
            pdf_id=document.pdf_id,
            full_text=full_text,
            extract_method="pdfium",
            text_by_page=payload,
        )
        return full_text, payload, "pdfium", pdf_txt_id

    pages = await ocr.extract_ocr_pages(pdf_bytes, ocr_method)
    full_text = join_page_text(pages)
    if not has_usable_text(full_text):
        raise ValueError("No text extracted from PDF")
    payload = _text_by_page_payload(pages)
    pdf_txt_id = await repo.update_pdf_text(
        conn,
        pdf_id=document.pdf_id,
        full_text=full_text,
        extract_method=ocr_method,
        text_by_page=payload,
    )
    return full_text, payload, ocr_method, pdf_txt_id

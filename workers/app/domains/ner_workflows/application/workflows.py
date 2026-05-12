from __future__ import annotations

from typing import Any

import asyncpg

from app.domains.ner_runs.application.workflows import execute_and_persist_ner_batch
from app.domains.ner_runs.domain import services as ner_run_services
from app.domains.ner_runs.domain.entities import NerPdfInput, NerRunOrigin
from app.domains.ner_runs.infrastructure.repositories import insert_pdf_text
from app.shared.infrastructure.s3 import download_pdf_bytes

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

    try:
        _report_progress(task, "text", "Extracting document text", 15)
        full_text, text_by_page, extract_method, pdf_txt_id = await _ensure_text(
            conn, document, project.ocr_method
        )

        _report_progress(
            task, "ner", "Extracting entities", 65, model=project.entity_extraction_model
        )
        system_prompt = optimized_prompt or ner_run_services.build_fallback_system_prompt(
            project.description, entity_types
        )
        ner_result = await execute_and_persist_ner_batch(
            conn,
            llm_clients,
            provider=model_metadata.provider,
            model=project.entity_extraction_model,
            project_id=document.project_id,
            prompt_id=project.active_prompt_id,
            origin=NerRunOrigin(ner_workflow_id=document.ner_workflow_id),
            task_name=_TASK_NAME,
            schema_name="ner_workflows",
            system_prompt=system_prompt,
            pdfs=[NerPdfInput(document.pdf_id, full_text, pdf_txt_id)],
            entity_types=entity_types,
        )

        _report_progress(task, "persist", "Saving extracted entities", 90)
        await repo.mark_source_processed(conn, source_id=document.source_id)
        return {
            "run_id": str(ner_result.run_id),
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
        pdf_txt_id = await insert_pdf_text(
            conn,
            pdf_id=document.pdf_id,
            full_text=full_text,
            extract_method="pdfium",
            created_by_domain="ner_workflows",
            text_by_page=payload,
        )
        return full_text, payload, "pdfium", pdf_txt_id

    pages = await ocr.extract_ocr_pages(pdf_bytes, ocr_method)
    full_text = join_page_text(pages)
    if not has_usable_text(full_text):
        raise ValueError("No text extracted from PDF")
    payload = _text_by_page_payload(pages)
    pdf_txt_id = await insert_pdf_text(
        conn,
        pdf_id=document.pdf_id,
        full_text=full_text,
        extract_method=ocr_method,
        created_by_domain="ner_workflows",
        text_by_page=payload,
    )
    return full_text, payload, ocr_method, pdf_txt_id

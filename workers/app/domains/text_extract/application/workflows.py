from __future__ import annotations

from typing import Any

import asyncpg

from ..infrastructure import repositories as repo
from .commands import ExtractMissingPdfTexts
from .use_cases import extract_exact_text


def _report_progress(
    task: Any | None,
    *,
    current: int,
    total: int,
    extracted: int,
    skipped: int,
) -> None:
    if task is None:
        return
    percent = int((current / total) * 100) if total else 100
    task.update_state(
        state="PROGRESS",
        meta={
            "phase": "text_extract",
            "message": "Extracting PDF text",
            "percent": percent,
            "details": {
                "current": current,
                "total": total,
                "extracted": extracted,
                "skipped": skipped,
            },
        },
    )


async def extract_missing_pdf_texts_workflow(
    conn: asyncpg.Connection,
    cmd: ExtractMissingPdfTexts,
    task: Any | None = None,
) -> dict:
    extracted_pdf_ids: list[str] = []
    skipped_pdf_ids: list[str] = []
    total = len(cmd.pdf_ids)
    status_rows = await repo.fetch_project_pdf_text_status(
        conn,
        project_id=cmd.project_id,
        pdf_ids=cmd.pdf_ids,
        extract_method=cmd.extract_method,
    )
    has_text_by_pdf_id = {row["pdf_id"]: row["has_text"] for row in status_rows}
    missing_project_pdf_ids = [pdf_id for pdf_id in cmd.pdf_ids if pdf_id not in has_text_by_pdf_id]
    if missing_project_pdf_ids:
        raise LookupError(
            "PDFs not found for project: "
            + ", ".join(str(pdf_id) for pdf_id in missing_project_pdf_ids)
        )

    for index, pdf_id in enumerate(cmd.pdf_ids, start=1):
        if has_text_by_pdf_id[pdf_id]:
            skipped_pdf_ids.append(str(pdf_id))
            _report_progress(
                task,
                current=index,
                total=total,
                extracted=len(extracted_pdf_ids),
                skipped=len(skipped_pdf_ids),
            )
            continue

        await extract_exact_text(
            conn,
            pdf_id=pdf_id,
            extract_method=cmd.extract_method,
            created_by_domain="text_extract",
            project_id=cmd.project_id,
        )
        extracted_pdf_ids.append(str(pdf_id))
        _report_progress(
            task,
            current=index,
            total=total,
            extracted=len(extracted_pdf_ids),
            skipped=len(skipped_pdf_ids),
        )

    return {
        "project_id": str(cmd.project_id),
        "extract_method": cmd.extract_method,
        "requested": total,
        "extracted": len(extracted_pdf_ids),
        "skipped": len(skipped_pdf_ids),
        "extracted_pdf_ids": extracted_pdf_ids,
        "skipped_pdf_ids": skipped_pdf_ids,
    }

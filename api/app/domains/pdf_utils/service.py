from dataclasses import asdict
import json
import os
import tempfile

import anyio
import asyncpg
import boto3
from pdf_ocr_utils import (
    RunpodOcrEndpointConfig,
    extract_text_from_pdf_by_page_via_image_bytes,
    make_runpod_ocr_client,
)
from pdfium_utils.annotate import extract_text_by_page as extract_pdfium_text_by_page
from pdfium_utils.search_and_annotate import highlight_phrases

from app.core.config import settings
from app.integrations import s3

from . import repository
from .schemas import (
    ExtractTextRequest,
    ExtractTextResponse,
    HighlightRequest,
    HighlightTask,
    PdfTask,
)

OCR_EXTRACT_METHODS = {
    "deepseek-ocr": "deepseek-ocr",
    "olm-ocr2": "olm-ocr2",
}


def _run_pdf_task(pdf_task: PdfTask) -> list:
    """Top-level dispatcher executed inside a worker process.

    Must be a module-level function so it is picklable.
    Returns a list of results in the same order as pdf_task.tasks.
    Add branches here as new task types are introduced.
    """
    results = []
    for task in pdf_task.tasks:
        if isinstance(task, HighlightTask):
            results.append(highlight_phrases(pdf_task.pdf_bytes, task.phrases))
        else:
            raise TypeError(f"Unknown PDF task: {type(task).__name__}")
    return results


def _page_results_to_payload(page_results: list) -> dict:
    return {
        "pages": [
            {"page_index": page.page_index, "text": page.text}
            if hasattr(page, "page_index")
            else {"page_index": page["page_index"], "text": page["text"]}
            for page in page_results
        ]
    }


def _join_page_text(text_by_page: dict) -> str:
    return "\n\n".join(str(page.get("text", "")).strip() for page in text_by_page["pages"]).strip()


def _metadata_text_by_page(row: asyncpg.Record) -> dict:
    text_by_page = row["text_by_page"]
    if isinstance(text_by_page, dict) and isinstance(text_by_page.get("pages"), list):
        return text_by_page
    if isinstance(text_by_page, str):
        try:
            parsed = json.loads(text_by_page)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, dict) and isinstance(parsed.get("pages"), list):
            return parsed
    return {"pages": [{"page_index": 0, "text": row["full_text"]}]}


def _build_s3_client(row: asyncpg.Record):
    s3_kwargs = {"region_name": row["region"]}
    if row["endpoint_url"]:
        s3_kwargs["endpoint_url"] = row["endpoint_url"]
    return boto3.client("s3", **s3_kwargs)


def _run_ocr_extract(pdf_bytes: bytes, request: ExtractTextRequest) -> dict:
    endpoint_configs = {
        "deepseek-ocr": RunpodOcrEndpointConfig(
            model="deepseek-ocr",
            endpoint_url=settings.DEEPSEEK_OCR_RUNPOD_ENDPOINT_URL,
            api_key=settings.OCR_RUNPOD_HTTP_TOKEN,
            timeout=settings.OCR_RUNPOD_TIMEOUT_SECONDS,
            retries=settings.OCR_RUNPOD_RETRIES,
        ),
        "olm-ocr2": RunpodOcrEndpointConfig(
            model="olm-ocr2",
            endpoint_url=settings.OLM_OCR2_RUNPOD_ENDPOINT_URL,
            api_key=settings.OCR_RUNPOD_HTTP_TOKEN,
            timeout=settings.OCR_RUNPOD_TIMEOUT_SECONDS,
            retries=settings.OCR_RUNPOD_RETRIES,
        ),
    }

    ocr_client = make_runpod_ocr_client(request.ocr_model, endpoint_configs)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        page_results = extract_text_from_pdf_by_page_via_image_bytes(
            tmp_path,
            ocr_engine=ocr_client,
        )
        return _page_results_to_payload(page_results)
    finally:
        ocr_client.close()
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except FileNotFoundError:
                pass


async def parallel_pdf_tasks(pdf_tasks: list[PdfTask]) -> list[list]:
    """Run multiple PdfTask objects in parallel subprocesses.

    Each PdfTask gets its own subprocess with an isolated pypdfium2 memory space,
    enabling true CPU parallelism without C-level data races.  All tasks within a
    single PdfTask share one subprocess call so the PDF bytes are pickled only once
    regardless of how many operations are batched for that PDF.

    Returns a list-of-lists: results[i] is the ordered list of results for
    pdf_tasks[i].tasks.
    """
    results: list = [None] * len(pdf_tasks)

    async def _run(idx: int, task: PdfTask) -> None:
        results[idx] = await anyio.to_process.run_sync(_run_pdf_task, task)

    async with anyio.create_task_group() as tg:
        for idx, task in enumerate(pdf_tasks):
            tg.start_soon(_run, idx, task)

    return results


async def highlight(conn: asyncpg.Connection, request: HighlightRequest) -> dict:
    """Orchestrate PDF highlighting: DB lookup -> S3 download -> highlight -> S3 upload."""
    row = await repository.fetch_pdf(conn, request.pdf_id)
    if row is None:
        raise LookupError(f"PDF not found: {request.pdf_id}")

    bucket_name = row["bucket_name"]
    filepath = row["filepath"]

    if not bucket_name:
        raise LookupError(f"PDF {request.pdf_id} has no S3 bucket configured")

    s3_client = _build_s3_client(row)

    pdf_bytes = await s3.get_object_bytes(s3_client, bucket_name, filepath)

    [[highlight_result]] = await parallel_pdf_tasks(
        [PdfTask(pdf_bytes=pdf_bytes, tasks=[HighlightTask(phrases=request.phrases)])]
    )
    output_bytes, phrase_results = highlight_result

    await s3.put_object_bytes(s3_client, bucket_name, request.output_key, output_bytes)

    successfully_highlighted = sum(1 for r in phrase_results if r.found)

    return {
        "pdf_id": str(request.pdf_id),
        "output_key": request.output_key,
        "bucket": bucket_name,
        "total_phrases": len(request.phrases),
        "successfully_highlighted": successfully_highlighted,
        "results": [asdict(r) for r in phrase_results],
    }


async def extract_text(
    conn: asyncpg.Connection,
    request: ExtractTextRequest,
) -> ExtractTextResponse:
    """Return stored PDF text, or extract via pdfium with Runpod OCR fallback."""
    row = await repository.fetch_pdf(conn, request.pdf_id)
    if row is None:
        raise LookupError(f"PDF not found: {request.pdf_id}")

    metadata_text = row["full_text"]
    if isinstance(metadata_text, str) and metadata_text.strip():
        return ExtractTextResponse(
            pdf_id=request.pdf_id,
            full_text=metadata_text,
            text_by_page=_metadata_text_by_page(row),
            extract_method=row["extract_method"],
            source="metadata",
            ocr_model=None,
        )

    bucket_name = row["bucket_name"]
    filepath = row["filepath"]

    if not bucket_name:
        raise LookupError(f"PDF {request.pdf_id} has no S3 bucket configured")

    s3_client = _build_s3_client(row)
    pdf_bytes = await s3.get_object_bytes(s3_client, bucket_name, filepath)

    pdfium_page_results = await anyio.to_thread.run_sync(
        extract_pdfium_text_by_page,
        pdf_bytes,
    )
    pdfium_text_by_page = _page_results_to_payload(pdfium_page_results)
    pdfium_full_text = _join_page_text(pdfium_text_by_page)
    if pdfium_full_text:
        await repository.update_pdf_text_metadata(
            conn,
            request.pdf_id,
            full_text=pdfium_full_text,
            extract_method="pdfium",
            text_by_page=pdfium_text_by_page,
        )
        return ExtractTextResponse(
            pdf_id=request.pdf_id,
            full_text=pdfium_full_text,
            text_by_page=pdfium_text_by_page,
            extract_method="pdfium",
            source="pdfium",
            ocr_model=None,
        )

    ocr_text_by_page = await anyio.to_thread.run_sync(_run_ocr_extract, pdf_bytes, request)
    ocr_full_text = _join_page_text(ocr_text_by_page)
    if not ocr_full_text:
        raise ValueError("No text extracted from PDF")

    extract_method = OCR_EXTRACT_METHODS[request.ocr_model]
    await repository.update_pdf_text_metadata(
        conn,
        request.pdf_id,
        full_text=ocr_full_text,
        extract_method=extract_method,
        text_by_page=ocr_text_by_page,
    )
    return ExtractTextResponse(
        pdf_id=request.pdf_id,
        full_text=ocr_full_text,
        text_by_page=ocr_text_by_page,
        extract_method=extract_method,
        source="ocr",
        ocr_model=request.ocr_model,
    )

from dataclasses import asdict

import anyio
import asyncpg

from app.integrations import s3

from . import repository
from .pdfium_utils import highlight_phrases
from .schemas import HighlightRequest, HighlightTask, PdfTask


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


async def highlight(conn: asyncpg.Connection, s3_client, request: HighlightRequest) -> dict:
    """Orchestrate PDF highlighting: DB lookup -> S3 download -> highlight -> S3 upload."""
    row = await repository.fetch_pdf(conn, request.pdf_id)
    if row is None:
        raise LookupError(f"PDF not found: {request.pdf_id}")

    bucket = row["bucket"]
    s3_key = row["location"]

    if not bucket:
        raise LookupError(f"PDF {request.pdf_id} has no S3 bucket configured")

    pdf_bytes = await s3.get_object_bytes(s3_client, bucket, s3_key)

    [[highlight_result]] = await parallel_pdf_tasks(
        [PdfTask(pdf_bytes=pdf_bytes, tasks=[HighlightTask(phrases=request.phrases)])]
    )
    output_bytes, phrase_results = highlight_result

    await s3.put_object_bytes(s3_client, bucket, request.output_key, output_bytes)

    successfully_highlighted = sum(1 for r in phrase_results if r.found)

    return {
        "pdf_id": str(request.pdf_id),
        "output_key": request.output_key,
        "bucket": bucket,
        "total_phrases": len(request.phrases),
        "successfully_highlighted": successfully_highlighted,
        "results": [asdict(r) for r in phrase_results],
    }

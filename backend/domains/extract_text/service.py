import boto3
import pymupdf4llm
import tempfile
from uuid import UUID
from fastapi.concurrency import run_in_threadpool
from .repository import PDFRepository
from .schemas import PDFTextResponse

class PDFService:
    def __init__(self, repo: PDFRepository, s3_bucket: str):
        self.repo = repo
        self.s3 = boto3.client("s3")
        self.bucket = s3_bucket

    async def extract_text(self, pdf_id: UUID) -> PDFTextResponse:
        s3_key = await self.repo.get_s3_key(pdf_id)

        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            await run_in_threadpool(
                self.s3.download_file,
                self.bucket,
                s3_key,
                tmp.name,
            )

            text = await run_in_threadpool(
                pymupdf4llm.to_markdown,
                tmp.name,
            )

        return PDFTextResponse(
            pdf_id=pdf_id,
            text=text,
        )

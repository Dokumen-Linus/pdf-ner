from uuid import UUID
from fastapi.concurrency import run_in_threadpool
from .repository import TemplateRepository
from .schemas import TemplateTextResponse

class TemplateService:
    def __init__(self, repo: TemplateRepository, _props: dict):
        self.repo = repo
        self.prop = _props

    async def get_name(self, id: UUID) -> TemplateTextResponse:
        row = await self.repo.get_row(id)

        def get_name(row) -> str:
            return row.name

        text = await run_in_threadpool(
                get_name,
                row,
            )

        return TemplateTextResponse(
            id=id,
            text=text,
        )

import hmac

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from .config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    if not api_key or not hmac.compare_digest(api_key, settings.API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def get_llm_clients(request: Request) -> dict:
    """Dependency that provides LLM clients from app state."""
    return {
        "anthropic": request.app.state.anthropic_client,
        "openai": request.app.state.openai_client,
        "gemini": request.app.state.google_ai_client,
    }

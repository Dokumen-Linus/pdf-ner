from fastapi import Request

def get_llm_clients(request: Request) -> dict:
    """Dependency that provides LLM clients from app state."""
    return {
        "anthropic": request.app.state.anthropic_client,
        "openai": request.app.state.openai_client,
        "gemini": request.app.state.google_ai_client,
    }

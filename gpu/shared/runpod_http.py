import os

from fastapi import HTTPException, Request, Response, status


def readiness_response(request: Request) -> Response:
    if not getattr(request.app.state, "ready", False):
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return Response(status_code=status.HTTP_200_OK)


def ensure_ready(request: Request) -> None:
    if not getattr(request.app.state, "ready", False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is still initializing",
        )


def normalize_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def run_app(app: object, default_port: int = 8000) -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", str(default_port))))

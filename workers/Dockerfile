# ---- Build stage ----
FROM python:3.13-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /uvx /bin/

# Tesseract build deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libc-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer caching)
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project --frozen

# Copy source and install project
COPY app/ app/
RUN uv sync --no-dev --frozen

# ---- Runtime stage ----
FROM python:3.13-slim AS runtime

# Tesseract OCR runtime dependency for pytesseract
RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false appuser

WORKDIR /app

COPY --from=build --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=build --chown=appuser:appgroup /app/app /app/app

ENV PATH="/app/.venv/bin:$PATH"

USER 1001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD ["python", "-c", "from app.core.config import settings; from redis import Redis; r = Redis.from_url(settings.REDIS_URL); r.ping()"]

CMD ["celery", "-A", "app.main", "worker", "--loglevel=info"]

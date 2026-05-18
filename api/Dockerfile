# ---- Build stage ----
FROM python:3.13-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /uvx /bin/

WORKDIR /src

# Install dependencies first (layer caching)
COPY api/pyproject.toml api/uv.lock ./api/
COPY packages/ ./packages/
WORKDIR /src/api
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
RUN uv sync --no-dev --no-install-project --frozen

# Copy source and install project
COPY api/app/ ./app/
RUN uv sync --no-dev --frozen

# ---- Runtime stage ----
FROM python:3.13-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/false appuser

WORKDIR /app

COPY --from=build --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=build --chown=appuser:appgroup /src/packages /src/packages
COPY --from=build --chown=appuser:appgroup /src/api/app /app/app

ENV PATH="/app/.venv/bin:$PATH"

USER 1001

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["python", "-c", "from urllib.request import urlopen; r = urlopen('http://localhost:8000/healthz', timeout=5); raise SystemExit(0 if r.status == 200 else 1)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

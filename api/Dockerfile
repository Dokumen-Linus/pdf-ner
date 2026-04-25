# ---- Build stage ----
FROM python:3.13-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /uvx /bin/

WORKDIR /src

# Install dependencies first (layer caching)
COPY api/pyproject.toml api/uv.lock ./api/
COPY packages/llm_providers/ ./packages/llm_providers/
COPY packages/otel_py/ ./packages/otel_py/
COPY packages/pdfium_utils/ ./packages/pdfium_utils/
WORKDIR /src/api
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

COPY --from=build --chown=appuser:appgroup /src/api/.venv /app/.venv
COPY --from=build --chown=appuser:appgroup /src/api/app /app/app

ENV PATH="/app/.venv/bin:$PATH"

USER 1001

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import socket; s = socket.create_connection(('localhost', 8000), timeout=5); s.close()"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

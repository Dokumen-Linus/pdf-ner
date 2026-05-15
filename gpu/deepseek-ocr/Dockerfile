FROM vllm/vllm-openai:latest

WORKDIR /app

ENV HF_HOME=/workspace/dokumen-ocr/deepseek-ocr/huggingface
ENV MODEL_NAME=deepseek-ai/DeepSeek-OCR
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV TMPDIR=/tmp/dokumen-ocr/deepseek-ocr
ENV VLLM_CACHE_ROOT=/workspace/dokumen-ocr/deepseek-ocr/vllm
ENV XDG_CACHE_HOME=/workspace/dokumen-ocr/deepseek-ocr/cache

COPY deepseek-ocr/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser && \
    mkdir -p /home/appuser && \
    chown -R appuser:appgroup /app /home/appuser

COPY --chown=appuser:appgroup deepseek-ocr/app.py .
COPY --chown=appuser:appgroup shared/ ./shared/

USER 1001

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; port = os.getenv('PORT_HEALTH', os.getenv('PORT', '8000')); urllib.request.urlopen(f'http://127.0.0.1:{port}/ping', timeout=5).close()"]

ENTRYPOINT ["bash", "-c", "mkdir -p \"$HF_HOME\" \"$VLLM_CACHE_ROOT\" \"$XDG_CACHE_HOME\" \"$TMPDIR\" && python app.py"]

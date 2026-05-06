FROM vllm/vllm-openai:latest

WORKDIR /app

ENV HF_HOME=/home/appuser/.cache/huggingface
ENV MODEL_NAME=allenai/olmOCR-2-7B-1025-FP8
ENV PORT=8000
ENV PROCESSOR_NAME=Qwen/Qwen2.5-VL-7B-Instruct
ENV PYTHONUNBUFFERED=1

COPY olm-ocr2/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser && \
    mkdir -p /home/appuser/.cache/huggingface && \
    chown -R appuser:appgroup /app /home/appuser

COPY --chown=appuser:appgroup olm-ocr2/app.py .
COPY --chown=appuser:appgroup shared/ ./shared/

USER 1001

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; port = os.getenv('PORT_HEALTH', os.getenv('PORT', '8000')); urllib.request.urlopen(f'http://127.0.0.1:{port}/ping', timeout=5).close()"]

ENTRYPOINT ["python", "app.py"]

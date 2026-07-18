# syntax=docker/dockerfile:1
FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt ./
# --extra-index-url pulls torch's CPU-only build (sentence-transformers'
# dependency) instead of PyPI default's much larger CUDA-bundled wheel.
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# Pre-fetch the sentence-embedding model weights at build time so the
# container never depends on HuggingFace Hub being reachable at runtime.
# Placed *before* `COPY app` (it only depends on requirements.txt/the model
# name, not application code) so an app-code-only change doesn't re-pay this
# ~3-minute download — only the first build or a requirements.txt change does.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

COPY app ./app

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

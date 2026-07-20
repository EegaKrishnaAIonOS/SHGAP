# syntax=docker/dockerfile:1
FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Pipecat's WebRTC transport imports opencv-python unconditionally (for video
# frame handling) even though this service is audio-only — its `cv2` native
# module needs these X11/GL shared libraries, absent from the slim base image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libxcb1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]

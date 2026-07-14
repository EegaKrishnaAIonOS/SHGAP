from fastapi import FastAPI

app = FastAPI(
    title="SHGAP Voice Service",
    description="Streaming ASR/TTS bridge, Telugu NLP, dialogue manager, RAG scheme-guidance.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "voice-service"}

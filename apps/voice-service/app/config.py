import os

from dotenv import load_dotenv

# Loads apps/voice-service/.env (if present) before Settings reads it — mirrors
# core-api's ConfigModule and ml-services' own config.py. A no-op when the
# file doesn't exist (e.g. in CI/Docker, where real env vars are injected).
load_dotenv()


class Settings:
    """Plain env-var config — no pydantic-settings dependency needed for this
    small a surface. Read with `.get(..., "")` rather than indexing, so
    importing this module (e.g. during test collection) never raises —
    connecting with an empty value fails clearly at the point of use instead.
    """

    groq_api_key: str = os.environ.get("GROQ_API_KEY", "")
    sarvam_api_key: str = os.environ.get("SARVAM_API_KEY", "")
    groq_llm_model: str = os.environ.get("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")
    # Sarvam, not Groq/Whisper, for STT — see ADR-0019's update: Sarvam's
    # saaras:v3 is tuned for Indian languages/code-switching and streams over
    # a WebSocket (lower latency than Whisper's upload-then-transcribe call).
    sarvam_stt_model: str = os.environ.get("SARVAM_STT_MODEL", "saaras:v3")
    sarvam_tts_model: str = os.environ.get("SARVAM_TTS_MODEL", "bulbul:v2")

    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
    # Same TTL policy as the JWT access token it stores — once the token
    # expires there's nothing useful left to resume with anyway (see
    # ADR-0019).
    session_ttl_seconds: int = int(os.environ.get("VOICE_SESSION_TTL_SECONDS", "900"))

    core_api_base_url: str = os.environ.get("CORE_API_BASE_URL", "http://localhost:3000")


settings = Settings()

import asyncio
import base64
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Response, UploadFile
from loguru import logger
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, ConfigDict, Field
from sarvamai import AsyncSarvamAI
from sarvamai.errors.bad_request_error import BadRequestError

from app.bot import run_bot
from app.config import settings
from app.session import SessionStore, build_default_session_store
from app.text_chat import handle_text_message
from app.transliteration import TextNormalizer, TransliterationError

session_store: SessionStore = build_default_session_store()
text_normalizer = TextNormalizer()
# Separate from the streaming SarvamSTTService/SarvamTTSService in app/bot.py
# (the live WebRTC pipeline) - this is Sarvam's plain REST batch client, used
# by both /api/transcribe (STT) and /api/speak (TTS) below for the chat
# widgets' one-shot clips/messages, outside any live call.
sarvam_client = AsyncSarvamAI(api_subscription_key=settings.sarvam_api_key)

# aiortc peer connections, keyed by *aiortc's own* pc_id — purely a live,
# in-process registry for WebRTC renegotiation (a network hiccup within the
# same call). Not the same key as `VoiceSession.session_id` in Redis; see
# app/session.py for why those are deliberately different identifiers.
peer_connections: dict[str, SmallWebRTCConnection] = {}

ICE_SERVERS = ["stun:stun.l.google.com:19302"]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await asyncio.gather(*(pc.disconnect() for pc in peer_connections.values()))
    peer_connections.clear()


app = FastAPI(
    title="SHGAP Voice Service",
    description="Streaming ASR/TTS voice assistant (Pipecat + Groq + Sarvam) — see ADR-0019.",
    version="0.1.0",
    lifespan=lifespan,
)

# T24/ADR-0033: real Prometheus instrumentation (ADR-0014 named the stack,
# deferred building it to T24) — request latency/count by method/handler/
# status, plus Python/process defaults, exposed at GET /metrics.
Instrumentator().instrument(app).expose(app, include_in_schema=False)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "voice-service"}


@app.get("/health/ready")
async def ready() -> dict:
    """T24/ADR-0033: a real readiness check against Redis — this service's
    hard dependency for session state (both the WebRTC voice pipeline and
    the text-chat fallback read/write through it on every turn)."""
    checks = {"redis": False}
    try:
        checks["redis"] = await session_store.ping()
    except Exception:  # noqa: BLE001 - any Redis failure means "not ready", not a 500
        pass

    if not all(checks.values()):
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ok", "checks": checks}


@app.post("/api/offer")
async def offer(request: dict[str, Any], background_tasks: BackgroundTasks) -> dict[str, Any]:
    """WebRTC signaling endpoint, matching `@pipecat-ai/small-webrtc-transport`'s
    real wire format exactly (verified against its source, not assumed):
    the connection id is `pc_id` (snake_case) at the top level, and any
    custom connect params passed via `webrtcRequestParams.requestData` on
    the client arrive nested under a `requestData` key here — not flat at
    the top level. On the *first* offer for a given browser session, that
    nested object must include `sessionId` (a client-generated, persisted
    id — see `app/session.py`), `accessToken` (the caller's own core-api
    JWT access token), and `language` ("te" or "en"). Renegotiation of an
    already-connected peer only needs the top-level `pc_id`, `sdp` and `type`.
    """
    pc_id = request.get("pc_id")

    if pc_id and pc_id in peer_connections:
        connection = peer_connections[pc_id]
        await connection.renegotiate(
            sdp=request["sdp"], type=request["type"], restart_pc=request.get("restart_pc", False)
        )
    else:
        custom = request.get("requestData") or {}
        session_id = custom.get("sessionId")
        access_token = custom.get("accessToken")
        language = custom.get("language", "te")
        if not session_id or not access_token:
            raise HTTPException(
                status_code=400, detail="sessionId and accessToken are required to connect"
            )

        connection = SmallWebRTCConnection(ice_servers=ICE_SERVERS)
        await connection.initialize(sdp=request["sdp"], type=request["type"])

        @connection.event_handler("closed")
        async def _on_closed(closed_connection: SmallWebRTCConnection) -> None:
            logger.info(f"Discarding peer connection {closed_connection.pc_id}")
            peer_connections.pop(closed_connection.pc_id, None)

        session = await session_store.get(session_id)
        if session is None:
            session = await session_store.create(session_id, access_token, language)
        else:
            # Same conversation, new connection — keep talking with the
            # access token/language just presented rather than a stale one.
            session.access_token = access_token
            session.language = language
            await session_store.save(session)

        background_tasks.add_task(run_bot, connection, session, session_store)

    answer = connection.get_answer()
    peer_connections[answer["pc_id"]] = connection
    return answer


class TextMessageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str
    # Only required to start a brand-new session — matches /api/offer's own
    # fresh-session fields (T12's text-input fallback needs to work even for
    # a member who has never connected by voice in this session at all).
    access_token: str | None = Field(default=None, alias="accessToken")
    language: str = "te"


class TextMessageResponse(BaseModel):
    reply: str
    tool_results: list[dict[str, Any]]


@app.post("/sessions/{session_id}/message", response_model=TextMessageResponse)
async def send_text_message(session_id: str, request: TextMessageRequest) -> TextMessageResponse:
    """Text-input fallback (T12) — a stateless HTTP alternative to speaking,
    sharing the same Redis-backed session, tool set, and system prompt as
    the live voice pipeline (see ADR-0021 for why this isn't done via RTVI
    client-message injection, which turned out to be client-side-only).
    """
    session = await session_store.get(session_id)
    if session is None:
        if not request.access_token:
            raise HTTPException(
                status_code=400, detail="accessToken is required to start a new session"
            )
        session = await session_store.create(session_id, request.access_token, request.language)
    elif request.access_token:
        session.access_token = request.access_token
        session.language = request.language
        await session_store.save(session)

    reply, tool_results = await handle_text_message(session, session_store, request.message)
    return TextMessageResponse(reply=reply, tool_results=tool_results)


class TranscribeResponse(BaseModel):
    transcript: str


@app.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile = File(...)) -> TranscribeResponse:
    """One-shot batch transcription for the floating chat widget's
    long-press voice recordings (apps/web's FloatingChatWidget and the
    interface/ static pages' mirror) - a short standalone clip, not the
    live WebRTC call app/bot.py handles. Sarvam's REST speech-to-text
    endpoint (distinct from the streaming one bot.py uses) is documented for
    clips under 30 seconds, which matches the widget's own recording cap.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="audio file is empty")

    # Browsers' MediaRecorder reports a content type like
    # "audio/webm;codecs=opus" - Sarvam's whitelist only matches the bare
    # "audio/webm" (no parameters), so the codec suffix has to come off
    # before this gets forwarded, or every request 400s.
    content_type = (file.content_type or "audio/webm").split(";")[0].strip()

    try:
        result = await sarvam_client.speech_to_text.transcribe(
            file=(file.filename or "recording.webm", audio_bytes, content_type),
            model=settings.sarvam_stt_model,
            # Same auto-detect choice as the live pipeline (app/bot.py) - SHG
            # members code-switch between Telugu and English mid-sentence.
            language_code="unknown",
        )
    except BadRequestError as exc:
        message = ""
        if isinstance(exc.body, dict):
            message = str(exc.body.get("error", {}).get("message", ""))
        if "exceeds the maximum limit" in message.lower():
            # Expected and recoverable, not a real failure: the client's
            # silence-based chunking (a 4s speech gap) is meant to keep every
            # chunk well under Sarvam's 30s cap, but someone who never pauses
            # can still blow past it before the next chunk boundary. Quietly
            # hand back no transcript rather than a loud warning + 502 - the
            # caller already treats an empty transcript as "nothing to show".
            logger.debug(f"Chunk exceeded Sarvam's 30s limit, dropping silently: {message}")
            return TranscribeResponse(transcript="")
        logger.warning(f"Sarvam batch transcription failed: {exc}")
        raise HTTPException(status_code=502, detail="transcription failed") from exc
    except Exception as exc:  # noqa: BLE001 - any other Sarvam failure surfaces as a clean 502
        logger.warning(f"Sarvam batch transcription failed: {exc}")
        raise HTTPException(status_code=502, detail="transcription failed") from exc

    return TranscribeResponse(transcript=result.transcript or "")


class SpeakRequest(BaseModel):
    text: str
    # Same "te"/"en" convention as the rest of this service (e.g.
    # TextMessageRequest.language) - not the app/bot.py streaming pipeline's
    # pipecat Language enum, since this is a plain REST call, not a session.
    language: str = "te"


def _resolve_batch_tts_language(language: str) -> str:
    return "te-IN" if language == "te" else "en-IN"


@app.post("/api/speak")
async def speak_text(request: SpeakRequest) -> Response:
    """One-shot batch TTS for spoken feedback outside a live call - e.g. the
    guidance agent's (inference/route.py) `message`, read aloud after a
    long-press dictation. Separate from the streaming SarvamTTSService in
    app/bot.py's WebRTC pipeline.
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is empty")

    try:
        result = await sarvam_client.text_to_speech.convert(
            text=text,
            target_language_code=_resolve_batch_tts_language(request.language),
            model=settings.sarvam_tts_model,
        )
    except Exception as exc:  # noqa: BLE001 - any Sarvam failure surfaces as a clean 502
        logger.warning(f"Sarvam batch TTS failed: {exc}")
        raise HTTPException(status_code=502, detail="speech synthesis failed") from exc

    if not result.audios:
        raise HTTPException(status_code=502, detail="no audio returned")

    # Sarvam's REST TTS response is base64-encoded WAV per audios[] entry
    # (one per input text - always exactly one here).
    audio_bytes = base64.b64decode(result.audios[0])
    return Response(content=audio_bytes, media_type="audio/wav")


class TransliterateRequest(BaseModel):
    text: str


class TransliterateResponse(BaseModel):
    text: str


@app.post("/transliterate", response_model=TransliterateResponse)
async def transliterate(request: TransliterateRequest) -> TransliterateResponse:
    """Normalizes Romanized/mixed-script Telugu text input into proper Telugu
    script (T11) — for the text-input fallback a future task adds to the
    assistant UI. See ADR-0020 for why this is LLM-based, not a dedicated
    transliteration model. Falls back to the original text, unchanged, if
    the underlying call fails — a text box should never break because a
    best-effort cleanup step couldn't run.
    """
    try:
        normalized = await text_normalizer.normalize(request.text)
    except TransliterationError as err:
        logger.warning(f"Transliteration failed, returning original text: {err}")
        normalized = request.text
    return TransliterateResponse(text=normalized)

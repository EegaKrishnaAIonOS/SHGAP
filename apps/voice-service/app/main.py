import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from loguru import logger
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pydantic import BaseModel, ConfigDict, Field

from app.bot import run_bot
from app.session import SessionStore, build_default_session_store
from app.text_chat import handle_text_message
from app.transliteration import TextNormalizer, TransliterationError

session_store: SessionStore = build_default_session_store()
text_normalizer = TextNormalizer()

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


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "voice-service"}


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

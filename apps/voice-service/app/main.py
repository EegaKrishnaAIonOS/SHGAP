import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from loguru import logger
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection

from app.bot import run_bot
from app.session import SessionStore, build_default_session_store

session_store: SessionStore = build_default_session_store()

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
    """WebRTC signaling endpoint. On the *first* offer for a given browser
    session, the caller must include `sessionId` (a client-generated,
    persisted id — see `app/session.py`), `accessToken` (their own core-api
    JWT access token), and `language` ("te" or "en"). Renegotiation of an
    already-connected peer only needs `pcId` (aiortc's connection id,
    returned in the first response), `sdp` and `type`.
    """
    pc_id = request.get("pcId")

    if pc_id and pc_id in peer_connections:
        connection = peer_connections[pc_id]
        await connection.renegotiate(sdp=request["sdp"], type=request["type"])
    else:
        session_id = request.get("sessionId")
        access_token = request.get("accessToken")
        language = request.get("language", "te")
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

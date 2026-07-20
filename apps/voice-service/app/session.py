import json
from dataclasses import asdict, dataclass, field
from typing import Any

import redis.asyncio as redis

from app.config import settings


@dataclass
class VoiceSession:
    """One voice conversation. Keyed by `session_id` — a client-generated id
    the frontend persists (e.g. in localStorage) and resends on every new
    WebRTC connection, deliberately *not* aiortc's own per-connection id
    (which is minted fresh every time and can't be chosen by the caller, so
    it can't identify the same conversation across a real reconnect).

    `history` is the full turn-by-turn transcript — durable in Redis (not
    just the in-memory `LLMContext` the live pipeline holds) so a new
    connection reusing the same `session_id` can rehydrate the conversation
    instead of starting over, and so it survives a voice-service restart
    mid-call.
    """

    session_id: str
    access_token: str
    language: str
    shg_id: str | None = None
    history: list[dict[str, str]] = field(default_factory=list)


class SessionStore:
    """Redis-backed session state (T10) — takes the redis client as a
    constructor argument (not a module-level singleton) so tests can pass a
    fake in-memory stand-in instead of touching a real Redis instance.
    """

    def __init__(self, redis_client: "redis.Redis[Any]"):
        self._redis = redis_client

    @staticmethod
    def _key(session_id: str) -> str:
        return f"voice:session:{session_id}"

    async def create(self, session_id: str, access_token: str, language: str) -> VoiceSession:
        session = VoiceSession(session_id=session_id, access_token=access_token, language=language)
        await self.save(session)
        return session

    async def get(self, session_id: str) -> VoiceSession | None:
        raw = await self._redis.get(self._key(session_id))
        if not raw:
            return None
        return VoiceSession(**json.loads(raw))

    async def append_turn(self, session_id: str, role: str, content: str) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        session.history.append({"role": role, "content": content})
        await self.save(session)

    async def set_shg_id(self, session_id: str, shg_id: str) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        session.shg_id = shg_id
        await self.save(session)

    async def delete(self, session_id: str) -> None:
        await self._redis.delete(self._key(session_id))

    async def save(self, session: VoiceSession) -> None:
        """Persists the given session as-is — for callers that mutated a
        `VoiceSession` directly (e.g. refreshing the access token on a new
        connection) rather than through one of the narrower setters above.
        """
        await self._redis.set(
            self._key(session.session_id),
            json.dumps(asdict(session)),
            ex=settings.session_ttl_seconds,
        )


def build_default_session_store() -> SessionStore:
    client = redis.from_url(settings.redis_url, decode_responses=True)
    return SessionStore(client)

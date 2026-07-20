import aiohttp
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from app.actions import build_tools
from app.config import settings
from app.session import SessionStore, VoiceSession

# Deliberately narrow: only what's actually backed by a real API today
# (product registration, price/stock lookup on the member's own listings).
# Scheme guidance and buyer search are out of scope for T10 — see ADR-0019.
_SYSTEM_PROMPT = """You are the SHGAP voice assistant, helping a Self Help Group (SHG) \
member in Andhra Pradesh manage their product listings by voice. Speak the same language \
the member is using — Telugu or English, switching naturally if they switch.

You can help with exactly two things:
1. Registering a new product (name, unit, price, and optionally a description, minimum \
order quantity, and stock) — use the register_product tool. Never ask the member to pick \
a category; it is determined automatically.
2. Checking the price or stock of one of their own already-listed products — use the \
check_product_price tool.

If the member asks about anything else (government schemes, buyer contacts, market \
prices for other SHGs, or anything you don't have a tool for), say plainly that this \
isn't available through voice yet and suggest they check the app or ask an official.

Keep responses short — one or two sentences. Your output is converted to speech, so \
never use special characters, markdown, or bullet points."""


def _resolve_tts_language(language: str) -> Language:
    return Language.TE_IN if language == "te" else Language.EN_IN


async def run_bot(
    webrtc_connection: SmallWebRTCConnection,
    session: VoiceSession,
    session_store: SessionStore,
) -> None:
    """Builds and runs one call's Pipecat pipeline. `session` already carries
    the caller's forwarded access token, chosen language, and (on a
    reconnect) prior conversation history — see ADR-0019 and `app/session.py`.
    `session_store` is the app-wide store `main.py` already owns (one Redis
    connection per process, not one per call).
    """
    tools = build_tools(session, session_store)

    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    messages.extend(
        {"role": turn["role"], "content": turn["content"]} for turn in session.history
    )
    is_fresh_session = not session.history

    context = LLMContext(messages=messages, tools=tools)
    context_aggregator = LLMContextAggregatorPair(context)

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    async with aiohttp.ClientSession() as http_session:
        # Sarvam, not Groq/Whisper, for STT (ADR-0019 update) — left at the
        # model's own auto-detect ("unknown") rather than pinned to the
        # session's chosen language, so Telugu/English code-switching
        # mid-utterance still transcribes correctly either way.
        stt = SarvamSTTService(api_key=settings.sarvam_api_key, model=settings.sarvam_stt_model)
        llm = GroqLLMService(api_key=settings.groq_api_key, model=settings.groq_llm_model)
        tts = SarvamTTSService(
            api_key=settings.sarvam_api_key,
            aiohttp_session=http_session,
            model=settings.sarvam_tts_model,
            params=SarvamTTSService.InputParams(language=_resolve_tts_language(session.language)),
        )

        pipeline = Pipeline(
            [
                transport.input(),
                stt,
                context_aggregator.user(),
                llm,
                tts,
                transport.output(),
                context_aggregator.assistant(),
            ]
        )

        worker = PipelineWorker(
            pipeline,
            params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
        )

        @context_aggregator.user().event_handler("on_user_turn_message_added")
        async def _on_user_message(_aggregator, message):
            await session_store.append_turn(session.session_id, "user", message.content)

        @context_aggregator.assistant().event_handler("on_assistant_turn_stopped")
        async def _on_assistant_message(_aggregator, message):
            if message.content:
                await session_store.append_turn(session.session_id, "assistant", message.content)

        @transport.event_handler("on_client_connected")
        async def on_client_connected(_transport, _client):
            logger.info(f"Voice client connected: {session.session_id}")
            if is_fresh_session:
                # Scripted kickoff so the assistant greets first rather than
                # waiting in silence — matches the reference bot's pattern.
                await worker.queue_frames([context_aggregator.user().get_context_frame()])

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(_transport, _client):
            logger.info(f"Voice client disconnected: {session.session_id}")
            await worker.cancel()

        runner = PipelineRunner(handle_sigint=False)
        await runner.run(worker)

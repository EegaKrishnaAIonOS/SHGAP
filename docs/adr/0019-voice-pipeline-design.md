# ADR-0019: Voice pipeline — Groq + Sarvam over Pipecat/WebRTC, JWT-forwarding action dispatcher, narrow action scope

- **Status:** Accepted
- **Date:** 2026-07-20
- **Sprint:** Sprint 2 (T10)

## Context

T10 asks for a "voice pipeline backend (ASR/TTS/dialogue)": a streaming audio endpoint, Telugu+English speech-to-text and text-to-speech, Redis-backed session state for multi-turn context, and an action dispatcher calling core-api for product registration, market/price enquiry and buyer search. Sprint 0's ADR-0006 had already named Bhashini/AI4Bharat as the ASR/TTS provider, and the sprint plan's own wording implies a raw WebSocket streaming endpoint.

The user supplied a working reference implementation (a Pipecat pipeline: Groq for STT + LLM, Sarvam for TTS, `SmallWebRTCTransport` for browser audio, plus a HeyGen talking-avatar video stage) from an unrelated prior POC ("Indigo Voice" customer-care demo). Its `.env` contained live, working API keys for Groq/Sarvam/Simli/HeyGen — never copied into this repo (which is public on GitHub); real keys were added directly to the gitignored local `.env` instead.

Three decisions were confirmed with the user before implementation (see conversation) rather than assumed:

## Decision

**Groq (STT + LLM) + Sarvam (TTS), superseding ADR-0006.** Sarvam supports Telugu natively (`te-IN`), and both have working API access today, unlike Bhashini/AI4Bharat's sandbox process which is a real POC-timeline risk. Groq's Whisper endpoint (`whisper-large-v3-turbo`) auto-detects language per utterance, which handles Telugu/English code-switching without an explicit language-detection step. Groq's `llama-3.3-70b-versatile` supports OpenAI-style function/tool calling, which the action dispatcher depends on.

**Pipecat over `SmallWebRTCTransport` (aiortc), not a raw WebSocket endpoint.** Reuses the reference implementation's proven transport rather than hand-rolling audio framing, jitter buffering, VAD and turn-taking. The reference code was written against an older Pipecat release; several APIs it uses have since moved or been deprecated in the 1.5.0 actually installed here (`pipecat.transports.network.small_webrtc` → `pipecat.transports.smallwebrtc.*`; `OpenAILLMContext` → the provider-agnostic `LLMContext`; `PipelineTask` deprecated in favor of `PipelineWorker`) — the code in this task targets 1.5.0's current API, not a copy of the reference file.

**Audio-only — no video avatar.** T10's own scope is a voice assistant; the reference code's HeyGen talking-avatar stage is dropped entirely rather than adding a new paid external dependency nothing in the architecture docs calls for.

**Auth: the caller's own JWT is forwarded, not a service credential.** The frontend (built in a later task) sends its already-authenticated user's core-api access token at WebRTC-connect time; `CoreApiClient` attaches it as a plain `Authorization: Bearer` header on every call. RBAC and ownership scoping are therefore identical to the web app's — a voice call can only ever act on data that user could already reach via the website. No separate voice-service-to-core-api credential exists. A token that expires mid-call surfaces as a spoken "your session expired, please refresh" rather than a crash (`CoreApiAuthError` → a fixed spoken result, not an exception that reaches the pipeline).

**Session identity (`session_id`) is deliberately not aiortc's own connection id (`pc_id`).** aiortc mints a fresh, unpredictable `pc_id` for every new `SmallWebRTCConnection` — a real reconnect (dropped call, new tab) can never present the same one. The frontend instead generates and persists its own `session_id` (e.g. in `localStorage`) and resends it on every connection attempt; `SessionStore` is keyed by that, `main.py` keeps a separate in-memory `pc_id → connection` map purely for same-connection WebRTC renegotiation. This is what actually makes "Redis session state for multi-turn context" (the sprint plan's own wording) achieve real reconnect continuity — keying by `pc_id` instead would have made the Redis store nearly useless (every reconnect gets a new key, so nothing is ever rehydrated).

**Action scope: exactly two tools, both backed by real data today.** `register_product` and `check_product_price` are the only actions implemented, because they're the only ones with a real core-api surface to call. "Market/price enquiry" beyond the caller's own listings and "buyer search" — both named in the sprint plan's T10 description — have no backing data or endpoints yet (no `Buyer` module exists; forecasting/market-intelligence is T14-17). Rather than fake these with the LLM's general knowledge (a real hallucination risk for a government platform's real users), the system prompt explicitly tells the assistant to say these aren't available yet and point the member to the app or an official. Same reasoning, extended to voice: the LLM is not given free rein to answer arbitrary questions (e.g. government scheme details) from its own training data — that's RAG-backed scheme guidance's job (a later task), not a general-purpose chatbot's.

**`register_product` reuses T08's `/categorization/suggest` endpoint** to resolve a category from the spoken product name — the same endpoint the web product form uses. If nothing clears T08's confidence floor, the tool reports failure and tells the member to add the product from the app instead, rather than guessing a category by voice. This is the same "say nothing rather than guess wrong" policy ADR-0017 already established, just enforced in a second, voice-shaped entry point instead of duplicating a new one.

## Alternatives Considered

- **Bhashini/AI4Bharat (ADR-0006's original pick)** — passed over now specifically for POC-timeline API-access risk; worth revisiting once/if API access is actually secured, since it remains the more India-government-aligned choice long-term.
- **A raw WebSocket audio-streaming endpoint** — the sprint plan's literal wording. Would mean implementing VAD, turn-taking, and jitter handling from scratch instead of relying on Pipecat's transport layer; rejected in favor of reusing proven, already-working reference code.
- **Session state keyed by aiortc's `pc_id`** — the reference server's own pattern. Rejected once it became clear this can never support resuming a genuinely dropped/reconnected call, which is the entire point of the sprint plan's Redis requirement.
- **Letting the LLM answer scheme/market/buyer questions from general knowledge** — more conversationally complete, but risks confidently wrong answers about real government schemes or market conditions reaching real SHG members; rejected until real RAG-backed grounding exists.

## Consequences

- Positive: reuses a proven, already-working pipeline instead of building transport/VAD/turn-taking from scratch; RBAC and ownership scoping need no new logic (the caller's own token does the work); category resolution for voice-registered products stays consistent with the web form's own behavior and confidence policy.
- Trade-offs: this explicitly supersedes ADR-0006 — if Bhashini/AI4Bharat access becomes available and is still wanted for the final deliverable, the STT/TTS provider swap is a real (if contained) piece of follow-up work, not a config change, since Pipecat's per-provider services aren't drop-in interchangeable at the API-shape level. TTS language is fixed for a call's lifetime (chosen once, from the member's stored preference) — a member who switches languages mid-call will still be transcribed correctly (Whisper auto-detects), but the assistant keeps replying in the language the call started in. The frontend piece that actually sends `sessionId`/`accessToken`/`language` and speaks WebRTC in a browser doesn't exist yet — T10's deliverable is the backend pipeline only, per the sprint plan's own "voice pipeline service" wording; a future task must build the browser-side connect/mic/speaker UI against the `/api/offer` contract documented here.

## Verified Behavior (real APIs + real Docker build, post-implementation)

Both the initial API keys supplied with the reference implementation had to be re-checked: Sarvam's worked as-is, but the Groq key returned 401 on every call including a basic `models.list()` — dead, not scope-restricted. A fresh key resolved this; real end-to-end calls against Groq (chat completion, tool-calling, Whisper transcription of a real Sarvam-synthesized audio clip) and Sarvam (speech synthesis) all confirmed working before this task was considered done.

The full `register_product`/`check_product_price` dispatch chain was run against the live core-api (not mocked) with a real demo SHG's JWT: resolving "my SHG", calling T08's `/categorization/suggest`, creating the product, and finding it again via search all worked correctly, including RBAC (a plain SHG member correctly got 403 attempting a master-data mutation that only ADMIN can perform). The first `/categorization/suggest` call after an ml-services restart took ~27s (the embedding model loading lazily, per ADR-0017) — not a bug, but real enough that `CoreApiClient`'s HTTP timeout was raised from 15s to 30s to tolerate it; every call after the model is warm is fast.

The Docker build (matching CI's exact build context, `apps/voice-service`, not the repo root) failed on first attempt: Pipecat's WebRTC transport imports `opencv-python` unconditionally for video-frame handling, even though this service never uses video — and `opencv-python`'s native `cv2` module needs X11/GL shared libraries (`libgl1`, `libxcb1`, and others) that `python:3.11-slim` doesn't have. Fixed by installing them via `apt-get` before the pip install layer; the rebuilt image boots and serves `/health` correctly.

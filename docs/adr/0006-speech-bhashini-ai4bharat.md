# ADR-0006: Bhashini / AI4Bharat for Telugu + English ASR & TTS

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The Voice Assistant (Module 2) must recognize Telugu and English speech from SHG members with varied accents/background noise, at a ≥90% accuracy target (per the POC success criteria), and must generate natural Telugu/English speech replies — ideally via a government-aligned, India-first speech stack given the MEPMA/DPDP context.

## Decision
Integrate Bhashini (National Language Translation Mission) and/or AI4Bharat's IndicASR/Indic-TTS models as the primary Telugu/English speech services, called from the Voice Service over REST/WebSocket, with response caching for repeated TTS phrases.

## Alternatives Considered
- **Global cloud ASR/TTS (Google/Azure/AWS Speech)** — strong general accuracy, but weaker rural-Telugu-accent tuning than India-first models, and raises data-residency questions under DPDP Act 2023.
- **Fully offline on-device ASR** — best for connectivity-poor areas, but on-device Telugu ASR accuracy is currently far below the ≥90% pilot target; kept as a future optimization, not a POC dependency.

## Consequences
- Positive: purpose-built for Indian languages/accents, aligns with a Government of India initiative fitting an AP State Government pilot, supports both ASR and TTS from one family of services.
- Trade-offs: Bhashini/AI4Bharat API maturity and rate limits are less proven at production scale than global clouds — the pilot must validate accuracy/latency directly (T11) and design a fallback/text-input path (T12) for when recognition confidence is low.

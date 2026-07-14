# ADR-0003: ML & Voice Services as separate Python/FastAPI services

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
Product categorization, forecasting, buyer recommendation, and the voice/NLP pipeline all depend on the Python ML ecosystem (IndicBERT, IndicNLP, Prophet/XGBoost, FAISS/pgvector, SHAP), which the Node.js Core API cannot use directly. These workloads are also CPU/GPU-bound and scale independently of API traffic.

## Decision
Run ML capabilities as standalone Python + FastAPI services (`ml-services` for categorization/forecasting/recommendation, `voice-service` for the streaming ASR/TTS + dialogue pipeline), called by Core API over internal REST, each independently deployable and scalable.

## Alternatives Considered
- **Embed ML in Core API via child processes / FFI** — avoids a network hop, but couples deploy/scale lifecycles and blocks using native Python ML libraries cleanly.
- **Single monolith Python backend (Django/FastAPI) for everything** — simpler topology, but loses NestJS's RBAC/module strengths for the CRUD-heavy registry/admin/analytics domain (ADR-0002).
- **Managed ML platform (SageMaker/Vertex AI) for all models** — faster to stand up but conflicts with India-region data-residency (DPDP Act 2023) and adds cost/lock-in not justified for a 90-day POC.

## Consequences
- Positive: each service scales/deploys independently (voice traffic vs. batch forecasting have very different load profiles); Python ecosystem used natively; matches the Container diagram's service boundaries.
- Trade-offs: adds inter-service network calls and two more services to containerize, monitor and secrete-manage (T03, T22).

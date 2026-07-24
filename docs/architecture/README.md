# Architecture & Tech Design

**AI-enabled Smart Market Linkage Platform for SHG Products**
Proof of Concept for the Andhra Pradesh State Government (MEPMA) — 90-day pilot across Anantapur, Krishna and Visakhapatnam districts.

This document is the T01 deliverable ("Architecture doc + diagram set in `/docs`"), Sprint 0, Foundation & Architecture. It ties together the four required diagrams and the Architecture Decision Records (ADRs) in [`/docs/adr`](../adr).

## 1. Purpose & Scope

The POC must demonstrate: SHG product registry with geo-tagging, a Telugu/English voice assistant, AI market intelligence (demand/price forecasting), a buyer-matching engine, dashboards for officials, multi-channel notifications, and integration readiness with MEPMA/ONDC/GeM/Agmarknet/WhatsApp — all under DPDP Act 2023 compliance, hosted in an India region. See `Proof of Concept Scope.docx` for the full functional scope and success criteria.

This document covers **development-only** scope per the sprint plan: architecture diagrams, technical documents and code — not procurement, training or live UAT.

## 2. Diagrams

Mermaid sources are in [`src/`](src/), rendered PNG/SVG in [`rendered/`](rendered/). Regenerate after editing a `.mmd` file with:

```bash
npx -p @mermaid-js/mermaid-cli mmdc -i docs/architecture/src/<name>.mmd -o docs/architecture/rendered/<name>.png -b white --scale 2
npx -p @mermaid-js/mermaid-cli mmdc -i docs/architecture/src/<name>.mmd -o docs/architecture/rendered/<name>.svg -b transparent
```

### 2.1 System Context — [`01-c4-system-context`](rendered/01-c4-system-context.png)

Six user roles (SHG member, buyer, ULB/district/state official, admin) and seven external systems (MEPMA, ONDC, GeM, Agmarknet, WhatsApp Business API, Bhashini/AI4Bharat, SMS/IVR/Email gateways) around the platform. Establishes the integration boundary from ADRs 0006, 0011, 0013.

### 2.2 Container Diagram — [`02-c4-container`](rendered/02-c4-container.png)

Five deployable containers — Web/PWA (React), Core API (NestJS), ML Services (FastAPI), Voice Service (FastAPI/WebSocket), Notification Service (NestJS/BullMQ) — plus three data stores: PostgreSQL 16 (PostGIS + pgvector), Redis, and S3/MinIO object storage. Matches the module boundaries used throughout the sprint plan (T06-T21).

### 2.3 Voice Data-Flow — [`03-dataflow-voice`](rendered/03-dataflow-voice.png)

Mic capture → ASR (Bhashini/IndicASR) → NLU (intent + entity extraction) → dialogue manager (Redis session state) → either RAG scheme-guidance or action dispatch to Core API → TTS → playback, with a fallback/clarification loop. Backs T10-T12.

### 2.4 Recommendation Data-Flow — [`04-dataflow-recommendation`](rendered/04-dataflow-recommendation.png)

Sales/enquiry/price/catalogue/buyer data → feature pipeline → embeddings + forecasting models → hybrid recommender → match score → learning-to-rank → SHAP explainability → `/recommendations/{shgId}` API → UI → accept/reject feedback loop back into the recommender. Backs T14-T17.

### 2.5 Deployment Diagram — [`05-deployment-diagram`](rendered/05-deployment-diagram.png)

India-region, MeitY-empanelled cloud; CDN for static PWA assets; WAF/API gateway with TLS termination; a Kubernetes/Compose cluster running all five service containers with HPA; managed PostgreSQL and Redis; KMS-backed secrets manager; Prometheus/Grafana/Loki observability. Backs T03, T13, T21-T24.

## 3. Architecture Decision Records

| ADR                                                               | Decision                                                                                                                                                                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](../adr/0001-frontend-react-pwa.md)                         | React + TypeScript as an installable PWA                                                                                                                                                                                               |
| [0002](../adr/0002-core-api-nestjs.md)                            | Core API on Node.js + NestJS                                                                                                                                                                                                           |
| [0003](../adr/0003-ml-voice-services-python-fastapi.md)           | ML & Voice Services as separate Python/FastAPI services                                                                                                                                                                                |
| [0004](../adr/0004-database-postgres-postgis-pgvector.md)         | Single PostgreSQL 16 engine with PostGIS + pgvector                                                                                                                                                                                    |
| [0005](../adr/0005-cache-queue-redis-bullmq.md)                   | Redis + BullMQ for cache, sessions and async jobs                                                                                                                                                                                      |
| [0006](../adr/0006-speech-bhashini-ai4bharat.md)                  | Bhashini / AI4Bharat for Telugu + English ASR & TTS                                                                                                                                                                                    |
| [0007](../adr/0007-telugu-nlp-stack.md)                           | IndicBERT / IndicNLP / spaCy for intent & entity extraction                                                                                                                                                                            |
| [0008](../adr/0008-forecasting-stack.md)                          | Prophet / XGBoost / Darts for demand & price forecasting                                                                                                                                                                               |
| [0009](../adr/0009-recommendation-stack.md)                       | Embeddings + pgvector/FAISS + LightFM + LightGBM + SHAP for buyer matching                                                                                                                                                             |
| [0010](../adr/0010-llm-rag-assistant.md)                          | LLM + pgvector RAG for scheme guidance and assistant replies                                                                                                                                                                           |
| [0011](../adr/0011-notification-providers.md)                     | MSG91 + WhatsApp Business API + Exotel + Amazon SES                                                                                                                                                                                    |
| [0012](../adr/0012-monorepo-tooling.md)                           | Nx/Turborepo mono-repo for all services                                                                                                                                                                                                |
| [0013](../adr/0013-infra-india-region-hosting.md)                 | India-region hosting on Docker/Kubernetes with Terraform                                                                                                                                                                               |
| [0014](../adr/0014-observability-stack.md)                        | Prometheus + Grafana + Loki for observability                                                                                                                                                                                          |
| [0015](../adr/0015-security-dpdp-baseline.md)                     | TLS + KMS + pgcrypto + OWASP ZAP + Snyk security/DPDP baseline                                                                                                                                                                         |
| [0016](../adr/0016-orm-prisma.md)                                 | Prisma as the ORM/migration tool for Core API (T02)                                                                                                                                                                                    |
| [0017](../adr/0017-product-categorization-approach.md)            | Zero-shot embedding similarity (multilingual sentence-transformer, not IndicBERT) for product categorization (T08)                                                                                                                     |
| [0018](../adr/0018-admin-portal-design.md)                        | Admin portal: moderation via existing status fields, ADMIN-only master data, demo official seed accounts (T09)                                                                                                                         |
| [0019](../adr/0019-voice-pipeline-design.md)                      | Voice pipeline: Groq+Sarvam over Pipecat/WebRTC (supersedes ADR-0006), JWT-forwarding dispatcher, narrow action scope (T10)                                                                                                            |
| [0020](../adr/0020-nlu-dialogue-approach.md)                      | NLU/dialogue: LLM tool-calling instead of fine-tuned IndicBERT, LLM-based transliteration instead of IndicXlit/fairseq (T11)                                                                                                           |
| [0021](../adr/0021-scheme-guidance-rag-and-assistant-frontend.md) | Scheme guidance RAG (ml-services retrieves, voice-service grounds), dedicated text-chat endpoint over RTVI injection, official Pipecat client SDKs for the frontend (T12)                                                              |
| [0022](../adr/0022-notification-engine-architecture.md)           | Notification Engine: one BullMQ queue, DI-swappable real/console providers per channel, DLT/Meta template-id based SMS/WhatsApp, only OTP has a real producer today (T13)                                                              |
| [0023](../adr/0023-market-intelligence-feature-pipeline.md)       | Market-intelligence feature pipeline: real Agmarknet ingestion (snapshot-only, paginated, UA-blocked by default), seasonality/festival/H3/lag features, APScheduler over Airflow, synthetic seed sales for a real feature series (T14) |
| [0024](../adr/0024-forecasting-models-and-mi-apis.md)             | Forecasting models: Prophet per product+district for demand, one pooled (not per-commodity) XGBoost for price, Darts dropped in favor of a hand-written backtest, H3-binning-as-clustering for hotspots (T15)                          |
| [0025](../adr/0025-buyer-registry-and-gem-opportunities.md)       | Buyer registry: admin-write/open-read (master-data pattern, not ownership-scoped), new `GemOpportunity` table (not JSON) for simulated procurement tenders, JSON bulk import over CSV (T16)                                            |

New decisions should be added as `NNNN-title.md` in `/docs/adr` using [`template.md`](../adr/template.md), numbered sequentially.

## 4. How this maps to the sprint plan

- **Sprint 0 (T01-T05):** this document + diagrams (T01), DB schema/migrations (T02) implementing the entities named in the container diagram, repo/CI-CD scaffold (T03) implementing the mono-repo (ADR-0012) and deployment target (ADR-0013), design system (T04), and Core API + Auth/RBAC (T05) implementing the Core API container (ADR-0002).
- **Sprints 1-4:** each module's build (T06-T21) implements one or more containers/flows shown here — Registry (T06-T09) is the Core API + Web/PWA containers; Voice (T10-T12) is the voice data-flow diagram; Market Intelligence + Matching (T14-T17) is the recommendation data-flow diagram; Dashboards + Integrations (T18-T21) consume the analytics/external-system edges from the container and context diagrams.
- **Sprint 5 (T22-T24):** security/DPDP hardening (ADR-0015), testing, and deployment to the environment shown in the deployment diagram (ADR-0013, ADR-0014).

## 5. Open questions / risks carried forward

- Bhashini/AI4Bharat production API limits and latency are unverified until T11 — a text-input/graceful-degradation path is planned regardless (ADR-0006).
- ONDC/GeM live API access may not be available during the pilot window; T21 explicitly builds simulated fallbacks per ADR-0013's integration-readiness requirement.
- LLM choice for the RAG scheme-guidance assistant (ADR-0010) is settled: Groq, reusing T10's LLM connection (ADR-0019/ADR-0021) rather than introducing a second provider.

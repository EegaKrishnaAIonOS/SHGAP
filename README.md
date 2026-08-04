# SHGAP — AI-enabled Smart Market Linkage Platform for SHG Products

Proof of Concept for the Andhra Pradesh State Government (MEPMA). See [`Proof of Concept Scope.docx`](./Proof%20of%20Concept%20Scope.docx) for the full functional scope and [`SHG_POC_Development_Sprint_Plan.xlsx`](./SHG_POC_Development_Sprint_Plan.xlsx) for the task-by-task sprint plan (T01-T24 across Sprint 0-5). Architecture and ADRs live in [`docs/`](docs/).

## Monorepo layout

Turborepo + npm workspaces ([ADR-0012](docs/adr/0012-monorepo-tooling.md)):

```
apps/
  web/                   React + TS + Vite PWA (T04/T07 build out the UI)
  core-api/              NestJS — auth/RBAC, registry, analytics, notifications (T05+)
  notification-service/  NestJS + BullMQ — SMS/WhatsApp/IVR/email (T13)
  ml-services/            Python + FastAPI — categorization, forecasting, recommender (T08/T14/T15/T17)
  voice-service/          Python + FastAPI — ASR/TTS bridge, NLU, dialogue, RAG (T10-T12)
packages/
  shared-types/           Shared TypeScript types (grows with each module)
database/                 Prisma schema, migrations, seed scripts (T02)
infra/
  docker-compose.yml         Local dev: Postgres+PostGIS+pgvector, Redis, MinIO, ClamAV
  docker-compose.apps.yml    T24: containerizes all 5 app services on the same network
  docker-compose.monitoring.yml  T24: Prometheus + Grafana + Loki + Alertmanager
  terraform/                 T24: real IaC (AWS ap-south-1), validated, not applied
  k8s/                       T24: real K8s manifests — blue/green, HPA, Ingress, monitoring
  scripts/                   T24: backup/restore, blue/green deploy/rollback scripts
docs/
  architecture/              C4 diagrams, ADRs index
  adr/                       Architecture Decision Records
  data-model.md              T24: ERD + data dictionary
  ml-model-cards.md          T24: model cards for every real ML model
  deployment-guide.md        T24: step-by-step, what's real vs. unapplied
  runbooks/                  T24: incident response, deploy/rollback, backup/restore
```

## Prerequisites

- Node.js 20+, npm 10+
- Python 3.11+ (each Python service manages its own `.venv`)
- Docker Desktop

## Local development

```bash
# 1. Install JS/TS dependencies (root, all workspaces)
npm install

# 2. Set up each Python service's virtualenv (once)
cd apps/ml-services && python -m venv .venv && ./.venv/Scripts/pip install -r requirements-dev.txt && cd ../..
cd apps/voice-service && python -m venv .venv && ./.venv/Scripts/pip install -r requirements-dev.txt && cd ../..

# 3. Start infra dependencies (Postgres+PostGIS+pgvector on :55432, Redis on :6379, MinIO on :9000/:9001)
docker compose -f infra/docker-compose.yml up -d

# 4. Apply DB migrations + seed master data
cd database && npm run migrate:deploy && npm run seed && cd ..

# 5. Run everything (Node apps via turbo; activate each Python venv separately for its own `dev`)
npm run dev
```

> **Port note:** the Postgres container publishes on **55432**, not 5432 — this avoids clashing with any native PostgreSQL install already on the machine. Default app ports: web `5173` (Vite dev server), core-api `3000`, notification-service `3001`, ml-services `8001`, voice-service `8002`.

## Common commands (via Turborepo)

```bash
npm run lint     # lint every workspace (ESLint for TS, ruff for Python)
npm run test     # test every workspace (Jest for NestJS, pytest for FastAPI)
npm run build    # build every workspace
```

`turbo` only re-runs tasks for workspaces whose inputs changed, and caches results locally.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml): lint + test + build on every push/PR (Node apps and Python services run as separate jobs), then builds and pushes each app's Docker image to GitHub Container Registry (`ghcr.io`) on pushes to `master`.

## Production-like local rehearsal

All 5 services, containerized (the exact images CI builds), plus a real Prometheus/Grafana/Loki/Alertmanager monitoring stack — running together, verified with live data (see [`docs/deployment-guide.md`](docs/deployment-guide.md) for the exact verification steps and results):

```bash
docker compose \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.apps.yml \
  -f infra/docker-compose.monitoring.yml \
  up -d --build
```

Web: `localhost:8080` · core-api Swagger: `localhost:3000/api/docs` · Grafana: `localhost:3002` (`admin` / `shgap_dev_password`) · Prometheus: `localhost:9090`.

## Cloud hosting

Real Terraform (AWS `ap-south-1`/Mumbai — a literal India region, per [ADR-0013](docs/adr/0013-infra-india-region-hosting.md)) and Kubernetes manifests (blue/green + rollback, HPA, Ingress, monitoring — [ADR-0033](docs/adr/0033-documentation-api-refs-deployment.md)) exist under `infra/terraform/` and `infra/k8s/`, validated (`terraform validate`, `kubectl kustomize`) but **not applied** — no cloud account/credentials exist in this environment. See [`docs/deployment-guide.md`](docs/deployment-guide.md) for the full picture of what's real versus written-but-unapplied, and [`docs/runbooks/`](docs/runbooks/) for the operational procedures (deploy/rollback, backup/restore, incident response) that go with it.

## Sprint plan reference

All 24 tasks across 6 sprints are complete.

| Sprint                                    | Tasks   | Status      |
| ----------------------------------------- | ------- | ----------- |
| Sprint 0 — Foundation & Architecture      | T01-T05 | ✅ Complete |
| Sprint 1 — Registry + Admin               | T06-T09 | ✅ Complete |
| Sprint 2 — Voice + Notify                 | T10-T13 | ✅ Complete |
| Sprint 3 — Market Intelligence + Matching | T14-T17 | ✅ Complete |
| Sprint 4 — Dashboards + Integrations      | T18-T21 | ✅ Complete |
| Sprint 5 — Security/DPDP + Docs + Deploy  | T22-T24 | ✅ Complete |

Plain-language, end-of-sprint summaries: [`docs/sprints/`](docs/sprints/).

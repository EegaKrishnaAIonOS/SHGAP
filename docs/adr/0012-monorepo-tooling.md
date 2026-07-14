# ADR-0012: Turborepo mono-repo for all services

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01, finalized in T03)

## Context

The platform is split across four deployable apps (web, core-api, ml-services, notification-service) plus a voice-service and shared libraries (types, UI components, config, database), all built by a small team on a tight 6-sprint timeline that needs consistent lint/test/build/CI across services (T03). Two of the five apps (ml-services, voice-service) are Python/FastAPI, not TypeScript — the monorepo tool has to orchestrate both language ecosystems, not just JS.

## Decision

Host all apps and shared libraries in a single mono-repo using **Turborepo** with npm workspaces, with shared ESLint/Prettier/tsconfig config and a single GitHub Actions pipeline (lint → test → build → push image) parameterized per app. Python apps participate as workspace packages with a thin `package.json` whose scripts shell out to `uv`/`pip`/`pytest`/`uvicorn`, so `turbo run lint|test|build` works uniformly across both languages.

## Alternatives Considered

- **Nx** — more powerful generators, dependency-graph visualization and a plugin ecosystem, but its strongest tooling (code generators, first-class project graph, Nx Cloud) is JS/TS-centric; Python support is third-party (`@nxlv/python`) and less mature. Turborepo's task runner is deliberately language-agnostic (it just runs whatever script each workspace defines), which fits a repo that's half Node and half Python better, at a lower configuration/learning cost for a small team on a 90-day clock.
- **Polyrepo (one repo per service)** — cleaner ownership boundaries at larger org scale, but adds cross-repo versioning/dependency overhead that a small team can't afford across a 90-day pilot with five interdependent services.
- **Plain npm/yarn workspaces without Turborepo** — lighter weight, but loses affected-project build caching and task orchestration that keep CI fast as the repo grows across Sprints 0-5.

## Consequences

- Positive: one PR can touch shared types + two apps atomically; `turbo`'s content-based caching only rebuilds/tests affected projects; consistent tooling reduces onboarding/config drift; the same `turbo run <task>` invocation works whether the underlying app is NestJS, Vite or FastAPI.
- Trade-offs: Python apps don't get Turborepo's finer-grained incremental-build awareness (e.g. no per-function caching) — CI treats each Python app's lint/test/build as a single cacheable unit keyed on its file hashes, which is coarser than Turborepo's native JS pipeline but sufficient at this repo's size.

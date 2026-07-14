# ADR-0012: Nx/Turborepo mono-repo for all services

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The platform is split across four deployable apps (web, core-api, ml-services, notification-service) plus a voice-service and shared libraries (types, UI components, config), all built by a small team on a tight 6-sprint timeline that needs consistent lint/test/build/CI across services (T03).

## Decision
Host all apps and shared libraries in a single mono-repo managed by Nx or Turborepo, with shared ESLint/Prettier/tsconfig config and a single GitHub Actions pipeline (lint → test → build → push image) parameterized per app.

## Alternatives Considered
- **Polyrepo (one repo per service)** — cleaner ownership boundaries at larger org scale, but adds cross-repo versioning/dependency overhead that a small team can't afford across a 90-day pilot with five interdependent services.
- **Plain npm/yarn workspaces without Nx/Turborepo** — lighter weight, but loses affected-project build caching and task orchestration that keep CI fast as the repo grows across Sprints 0-5.

## Consequences
- Positive: one PR can touch shared types + two apps atomically; CI only rebuilds/tests affected projects; consistent tooling reduces onboarding/config drift.
- Trade-offs: mono-repo tooling (Nx/Turborepo) has its own learning curve and must be set up correctly in Sprint 0 (T03) to pay off across later sprints.

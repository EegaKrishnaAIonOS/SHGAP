# ADR-0002: Core API on Node.js + NestJS

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The core domain (auth/RBAC, SHG & product registry, buyer registry, analytics aggregation, notification orchestration, admin) is CRUD- and API-heavy rather than compute-heavy, and needs to move fast across Sprints 0-5 with strong typing shared against the React frontend.

## Decision
Use NestJS (Node.js + TypeScript) for the Core API: modular architecture, built-in DI, guards/interceptors for RBAC and district/ULB scoping, first-class Swagger/OpenAPI generation, and Prisma/TypeORM for PostgreSQL access.

## Alternatives Considered
- **Django/DRF (Python)** — mature admin+auth tooling, but splits the team across two backend languages when ML/voice already require Python; NestJS keeps API code TypeScript like the frontend.
- **Spring Boot (Java)** — enterprise-grade and common in government stacks, but heavier boilerplate and slower iteration for a 90-day POC.
- **Express (bare Node)** — lighter weight, but lacks NestJS's structured module/guard system, which we need for RBAC + geo-scoping across 5 role types.

## Consequences
- Positive: shared TypeScript types/DTOs with the React frontend; NestJS guards cleanly implement RBAC (T05) and district/ULB data scoping; Swagger comes near-free for every module.
- Trade-offs: Node.js is single-threaded — CPU-heavy work (ML, forecasting) must live in the separate Python ML services, not in Core API.

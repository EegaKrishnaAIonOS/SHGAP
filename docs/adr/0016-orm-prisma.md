# ADR-0016: Prisma as the ORM/migration tool for Core API

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T02)

## Context
T02 needs a schema-first data model (users/roles, SHG, product, buyer, sales, enquiry, recommendation, notification, consent, audit_log, plus master data) with PostGIS geometry columns and pgvector embedding columns, versioned migrations that apply cleanly to a fresh database, and strong TypeScript types shared with the NestJS Core API (ADR-0002).

## Decision
Use Prisma (schema in `database/schema.prisma`, migrations via `prisma migrate`) as the ORM and migration tool. Declare the `postgis` and `vector` extensions via Prisma's `postgresqlExtensions` preview feature; model geometry/vector columns as `Unsupported("geometry(Point,4326)")` / `Unsupported("vector(768)")` and access them through `$queryRaw`/`$executeRaw` for geo queries and similarity search, since Prisma's typed query layer doesn't natively model these types.

## Alternatives Considered
- **TypeORM** — has more mature decorator-based support for custom column types (geometry, vector) without dropping to raw SQL, and was the sprint plan's other named option. Rejected in favor of Prisma because Prisma's migration diffing (`prisma migrate dev`) and generated client types are stronger for the CRUD-heavy registry/admin/analytics surface that dominates this codebase, and geo/vector access was already going to need hand-written SQL for PostGIS functions (`ST_DWithin`, etc.) and pgvector similarity operators (`<=>`) regardless of ORM.
- **Raw SQL migrations only (no ORM)** — maximum control over PostGIS/pgvector SQL, but loses generated types and migration-diffing speed needed across 6 one-week sprints touching this schema repeatedly.

## Consequences
- Positive: fast, reviewable migration diffs; generated TypeScript client types flow directly into NestJS services and DTOs; `prisma erd` / `prisma-erd-generator` can produce the ER diagram directly from the schema, keeping it in sync as the schema evolves.
- Trade-offs: any query touching a geometry or vector column must use `$queryRaw`/`$executeRaw` instead of the typed client — this is isolated to a small set of repository methods (geo search, recommendation similarity) rather than spread across the codebase.

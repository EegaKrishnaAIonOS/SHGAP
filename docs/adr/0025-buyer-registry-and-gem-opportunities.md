# ADR-0025: Buyer registry backend and simulated GeM opportunities

- **Status:** Accepted
- **Date:** 2026-07-24
- **Sprint:** Sprint 3 (T16)

## Context

T16 asks for a buyer registry: model buyers (institutional/retail/bulk/government-procurement) with demand profiles, categories and locations; buyer CRUD + import endpoints; and seeded sample buyers plus GeM procurement opportunities. The `Buyer` model (with `BuyerType`, PostGIS location, JSON `demandProfile`, pgvector `embedding`, and a `BuyerCategoryInterest` join table) already existed from T02's initial migration — T16 is the API/service/seed layer on top of it. No `GemOpportunity`-shaped table existed anywhere in the schema.

## Decision

**A new `GemOpportunity` model, not JSON stuffed into `Buyer.demandProfile`.** A procurement opportunity (a specific, time-bound tender: a reference number, a submission deadline, a quantity, a status that changes over its lifecycle) is conceptually different from a buyer's general demand profile (typical volume/frequency/price band, which doesn't expire or get awarded). Modeling them separately keeps both honest: `demandProfile` stays a simple descriptive JSON blob, `GemOpportunity` is real, queryable, filterable relational data with its own status lifecycle (`OPEN`/`CLOSED`/`AWARDED`/`CANCELLED`).

**Opportunities are read-only via the API today** (`GET /gem-opportunities`, `GET /gem-opportunities/:id`) — created only through the seed script for now. Real GeM ingestion is explicitly T21's "integration readiness" scope (ADR-0013 already notes ONDC/GeM live access may not be available during the pilot window and plans simulated fallbacks there); T16 only needed seeded sample opportunities, not a write API nobody would call yet. Every seeded row carries `isSimulated: true` so a later real GeM import can coexist with — and be told apart from — today's simulated data without a schema change.

**Buyer writes are ADMIN-only; reads are open to any authenticated user** — following `master-data`'s pattern, not `shgs`/`products`' ownership pattern. A buyer isn't self-registered or owned by any one SHG/user the way a SHG's own products are; the registry is centrally curated data that officials and the matching engine (T17) need to read freely, and only admins should be able to write.

**`POST /buyers/import` is a best-effort bulk JSON import**, not CSV parsing. One invalid row (e.g. a lat without a matching lng) is reported per-index in the response rather than aborting the whole batch — an admin importing 50 buyers from an external source shouldn't lose 49 good rows because one had a typo. CSV parsing was considered and rejected: no CSV-handling convention exists anywhere else in this codebase, and the sprint plan's "import endpoints" wording doesn't specify a format — a validated JSON array reuses the exact same `CreateBuyerDto` validation as the single-create endpoint, with less new surface area than adding a CSV dependency for a POC.

**`demandProfile` is validated via a small nested DTO** (`BuyerDemandProfileDto`: typical volume/unit/frequency/price band), not accepted as an untyped JSON blob — this is genuinely user-submitted data through a public write endpoint, unlike the JSON fields on `Recommendation`/`Notification` (which are only ever written by ml-services/internal code, never directly from a client request body).

**Buyer category interests use the existing `Category` taxonomy and `BuyerCategoryInterest` join table** (already in the schema) rather than inventing a parallel buyer-specific category system — `categoryIds` on create/update fully replaces a buyer's interests (`deleteMany` + recreate), matching how a caller would expect "set my categories to X" to behave.

## Alternatives Considered

- **JSON opportunities inside `Buyer.demandProfile`** — rejected (see Decision): conflates two different concepts and gives up real filtering/indexing (by status, deadline, category) for no benefit.
- **Full CRUD for GeM opportunities** — rejected for now; the sprint task only asked to seed them, and a write API with no real caller yet is unused surface area. Trivial to add when T21 needs to actually ingest live GeM data.
- **CSV-based buyer import** — rejected; no precedent in the codebase, adds a new parsing dependency, and the sprint plan doesn't require a specific file format. A validated JSON array satisfies "import endpoint" with far less new surface.
- **Scope-based (ownership) access control for buyers**, mirroring `shgs`/`products` — rejected; buyers aren't owned by any SHG or user in this schema, so `ScopeGuard`'s self/ulb/district/global model doesn't apply. `RolesGuard` + open reads (the `master-data` pattern) fits what the registry actually is: centrally curated reference data.

## Consequences

- Positive: the full path — migration, buyer CRUD + import, GeM opportunity list/detail, RBAC (admin-write, open-read, verified against a real non-admin token receiving 403), and seed data — was verified end-to-end against the real dev Postgres and a live core-api instance, not just unit-mocked. 20 new unit tests pass alongside the existing 107.
- Trade-offs: `GemOpportunity` has no write API yet, so today it can only be populated by re-running the seed script or a direct DB write; this is intentional (see Decision) but means T21's real GeM integration will need to add a write/upsert path when it lands, not just point an existing endpoint at a new data source.
- Incidental fix made while running the migration: `database/prisma/migrations/migration_lock.toml` never existed in this repo (both prior migrations were seemingly applied without Prisma's own interactive `migrate dev`, which the local non-interactive shell also couldn't run) — created it now so `prisma migrate diff`/future tooling that expects it works correctly; the diff it enabled also caught and required manually excluding several false-positive `DROP INDEX` statements against the existing PostGIS/pgvector raw-SQL-managed indexes (`buyers_location_gist_idx`, `buyers_embedding_ivfflat_idx`, etc.) — Prisma's schema DSL can't see indexes on `Unsupported` columns, so its migration diff wanted to drop them; confirmed directly that all five pre-existing indexes survived the new migration untouched.

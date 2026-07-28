# ADR-0030: External integrations — MEPMA + Agmarknet + ONDC + GeM

- **Status:** Accepted
- **Date:** 2026-07-28
- **Sprint:** Sprint 4 (T21)

## Context

T21 is the last Sprint 4 task, "Very High" complexity — real or simulated readiness across four separate external systems: the MEPMA SHG database, Agmarknet market prices, ONDC (Beckn protocol) catalogue publishing, and GeM procurement opportunities, plus integration tests with simulated fallbacks. It depends on T06 (product registry), T13 (notification engine), and T16 (buyer registry/GeM). The project's own scope doc is explicit that this should be "live where APIs are available, otherwise simulated" — none of the four have a live API actually available to this pilot, so every one of them is a real mechanism wired to a **simulated or self-generated** data/network layer, never a fabricated result.

Research before writing any code found that Agmarknet ingestion (T14/ADR-0023) and GeM's data model (T16/ADR-0025) already existed — the real gap for each was narrower than "build the whole integration":

- Agmarknet: real ingestion, scheduling, and feature-pipeline integration were already done in T14. The only actual gap was a dashboard-facing read path — it had never been exposed past ml-services' internal forecasting pipeline.
- GeM: `GemOpportunity` (T16) was read-only by design, deliberately deferring "add a write/upsert path" to this exact task (ADR-0025's own words).
- MEPMA: `Shg.mepmaRegistrationNumber` has existed since T02, unique but never read, written, or validated against anything external.
- ONDC: zero code existed anywhere.

## Decision

**MEPMA sync never fabricates an SHG record.** `Shg.contactUserId` is a required FK to a real registered platform user — a government registry entry with no platform account yet has no user to attach. Rather than relaxing that constraint (which would ripple through ownership checks, product attribution, and every place that assumes an SHG has a real contact), `MepmaSyncService.syncShgRegistry()` does real identity-mapping + dedupe against the platform's actual `Shg` table (match by `mepmaRegistrationNumber`, or by name+district for an SHG that self-registered before ever being MEPMA-synced, backfilling its registration number), and **reports** anything left over as `unmatched` — a real, honest "awaiting onboarding" gap, never a phantom row. The registry itself comes from a `MepmaSyncProvider` interface with only a `SimulatedMepmaSyncProvider` implementation today (no live MEPMA API access exists) — the exact DI-swappable-provider shape T13's `SmsProvider` already established, so a real HTTP-calling provider is a one-file swap later, not a rewrite. Scheduled daily via `SchedulerRegistry.addInterval`, mirroring T18's `AnalyticsSchedulerService` pattern exactly, plus a manual `POST /mepma/sync` (ADMIN).

**Agmarknet gets one new read endpoint, not new ingestion.** `GET /market-intelligence/prices` (ml-services) reads the same `price_history_store` the forecasting pipeline already reads, proxied through a new `GET /analytics/market-prices` (core-api, best-effort — an unreachable ml-services degrades to an empty list, matching `CategorizationService`'s convention, not the OTP path's throw-on-failure one, since a missing price panel shouldn't break a whole dashboard). Surfaced as a new "Market prices" panel on the government dashboard.

**GeM opportunities get a real write path that triggers a real alert.** `POST /gem-opportunities` (+ bulk `import`, both ADMIN) default `isSimulated: false` — unlike the T16 seed data, a real write through this API is real, not a demo row. Every create matches the opportunity's `categoryId` against every active SHG with a product in that category and dispatches a `TENDER_OPPORTUNITY` notification per match — `NotificationEvent.TENDER_OPPORTUNITY`'s templates (WhatsApp/voice/email, English+Telugu) have existed, completely unused, since T13/ADR-0022; this is their first real caller. Dispatch runs through a new `NotificationDispatchClient` — generic (any event, not just OTP), and deliberately best-effort: a delivery failure never blocks or rolls back the opportunity write it's attached to, matching `CategorizationService`'s "unreachable = log + continue" convention rather than the OTP path's "unreachable = throw."

**ONDC readiness is real cryptography over a self-generated identity, not a registered network participant.** No ONDC Registry subscription exists for this pilot, so `OndcService` generates a fresh Ed25519 keypair at boot (Node's built-in `crypto`, no new dependency — confirmed available on the Node 22 runtime in use) purely to demonstrate the real signing mechanism working end-to-end. `POST /ondc/on_search` builds a genuine Beckn `on_search` catalogue response (real field names, real available products/prices grouped by SHG as Beckn "providers") and signs it with a real Ed25519 signature in the real Beckn `Authorization` header format. One honest, documented gap: the Beckn spec's digest algorithm is BLAKE-512, which has no Node built-in implementation; this substitutes SHA-512, labeled as such in both the code and the `/ondc/readiness` self-check response, rather than silently claiming full protocol conformance it doesn't have. `GET /ondc/readiness` reports real catalog size and confirms `registeredWithOndcNetwork: false` plainly, rather than implying live network participation.

**Integration tests are Jest/pytest unit tests (mocking the transport layer, per this codebase's existing convention) plus a runnable Postman/Newman collection** (`apps/core-api/test/postman/t21-external-integrations.postman_collection.json`) exercising the real HTTP endpoints end-to-end. The collection's public folder (ONDC `on_search`/`readiness`) needs no setup and can run in CI unattended; its admin-gated folder (MEPMA sync, GeM create/list, market prices) needs an `adminToken` supplied via the OTP flow first — Postman/Newman has no way to read an OTP out of Redis itself, so that one step honestly stays outside the collection rather than being faked.

## Real findings from verification

- Every new endpoint was exercised against the real running stack (core-api + Postgres + Redis + a real admin JWT) after implementation, the same way every prior T18-T20 verification was done in this environment.
- Discovered, while running the full ml-services suite for verification, a pre-existing, reproducible (not merely theoretical) flaky test in the unrelated categorization module (T08): `test_refreshes_category_cache_once_ttl_expires` asserts a cache refetch after `cache_ttl_seconds=0`, but the cache check (`elapsed > ttl`) can see `elapsed == 0` on Windows' coarser `time.monotonic()` resolution when two awaited calls land in the same clock tick. Left unfixed — out of T21's scope and not something this task touched — but flagged here since it's a real, reproducible finding, not assumed.

## Alternatives Considered

- **Relaxing `Shg.contactUserId` to nullable** so a MEPMA sync could create phantom SHG rows directly — rejected; a much larger, riskier schema change than this task calls for, and it would let a government registry entry silently masquerade as a real, onboarded platform SHG.
- **A new `mepma_sync_records` table** to persist every sync run's history — considered, but the stateless "recompute from the provider + current `Shg` table every run" design already gives a correct, idempotent result without a new migration; revisit if MEPMA sync history itself needs to be queried later.
- **Proxying ml-services' `/hotspots` for the Agmarknet dashboard panel** — rejected; that endpoint aggregates real _sales_ by H3 cell, not Agmarknet prices, and conflating the two would misrepresent what the panel is showing.
- **A `blake2` npm dependency for spec-exact ONDC digests** — rejected for a readiness demonstration; the substitution is small, honestly labeled, and swappable later if this platform ever pursues real ONDC network registration.
- **Full CRUD (update/delete) for GeM opportunities** — rejected; the task asks for opportunities to be recorded and matched, not managed end-to-end; `create`/`import` cover every real caller today.

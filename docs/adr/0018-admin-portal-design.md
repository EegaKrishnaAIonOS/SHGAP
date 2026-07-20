# ADR-0018: Admin portal — moderation via existing status fields, ADMIN-only master data, demo official seed accounts

- **Status:** Accepted
- **Date:** 2026-07-20
- **Sprint:** Sprint 1 (T09)

## Context

T09 asks for admin backend endpoints to "manage users/SHGs/products... approve/flag content", full CRUD for master data (categories, districts, ULBs, mandals, festival calendar), an auth-gated role-based admin frontend, and summary tiles. Several design questions weren't specified in the sprint plan and needed a concrete answer:

1. What does "approve/flag content" actually change in the data model?
2. Who can edit master data — just ADMIN, or any official?
3. How does the frontend know a user's roles, and how does it gate the admin portal?
4. Without any seeded official/admin account, the admin portal is unreachable in a fresh environment — is that in scope to fix?

## Decision

**Moderation reuses existing fields, not a new workflow.** `Shg.isActive` and `Product.isAvailable` already exist and are already admin-editable via the existing owner-or-admin `PATCH /shgs/:id` and `PATCH /products/:id` endpoints (built in T06). "Approve/flag content" is implemented as the admin portal exposing these same toggles in a management table, not a new pending/approved/rejected state machine. Adding a real moderation workflow (submission → review → publish) would need new schema and is a bigger decision than a 3-person-day task should make unilaterally.

**Master data writes are ADMIN-only; reads stay open.** `GET /master-data/*` remains unauthenticated-role (any logged-in user) since the SHG registration and product forms already depend on these for their dropdowns (T07). The new `POST`/`PATCH`/`DELETE` endpoints require the `ADMIN` role specifically — not `STATE_OFFICIAL` or other officials — since master data (districts, categories, ...) is platform-wide configuration, not something a district/ULB/state official should be able to change unilaterally.

**Frontend role-gating is a UX mirror, not the security boundary.** `AuthContext` now fetches `/users/me` once per session and exposes `hasRole(...)`. A new `RequireRole` route guard hides `/admin/*` from anyone without an official role, and hides the Master Data tab specifically from non-ADMIN officials. This is purely so the wrong users never see a page that will just reject their actions — the backend's `RolesGuard`/`@Roles(...)` on every mutating endpoint is what actually enforces access; a user who bypasses the frontend gate (e.g. via devtools) gains nothing, since every write still 403s server-side.

**Added demo official/admin seed accounts.** Before this task, the `roles` table had five roles seeded but zero users held anything other than `SHG` — there was no way to log into the admin portal or any officials-facing screen in a fresh environment. Added one demo account per official role (`ADMIN`, `STATE_OFFICIAL`, `DISTRICT_OFFICIAL`, `ULB_OFFICIAL`) to `database/seed/demo-data.ts`, with the district/ULB officials scoped to Anantapur (where the existing demo SHGs/products already live, so their scoped views have real data to show). This was necessary for the "Admin Portal" to be a working, demoable deliverable at all, not just compiling code.

**Master data admin UI is one route with in-page tabs**, not five separate routes — each of the five lists (districts, ULBs, mandals, categories, festival calendar) is small (single digits to a few dozen rows for this pilot), so a tab switch is no heavier than a route change and keeps the routing table simpler.

## Alternatives Considered

- **A real content-moderation state machine** (`PENDING_REVIEW` → `APPROVED`/`REJECTED` on `Product`/`Shg`) — more faithful to "approve/flag" as a literal review workflow, but needs a schema migration and a redesign of the SHG-facing create flow (does a new product go live immediately, or wait for approval?) — a product decision beyond this task's scope, not just an engineering one.
- **Letting `STATE_OFFICIAL` edit master data too** — plausible (a state official arguably outranks a plain admin), but the sprint plan explicitly frames master-data management as "admin", and narrower access is easier to widen later than to walk back.
- **Not seeding demo officials, leaving admin-role provisioning as a manual/future step** — would leave the admin portal deliverable undemonstrable out of the box; rejected since a working demo login is table stakes for a POC deliverable literally named "Admin Portal".

## Consequences

- Positive: no schema migration needed; moderation actions are exactly as reversible as the existing owner/admin update endpoints already were; master-data mutations are safely scoped to the one role that should hold them; the admin portal is actually reachable and demoable today.
- Trade-offs: "approve/flag" is a coarser action (available/unavailable) than a real review workflow — a product goes live the moment an SHG creates it, and admin moderation is purely reactive (hide it after the fact) rather than gating publication upfront. Deleting in-use master data (a district with ULBs, a category with products) fails with a clean 409 rather than silently cascading — correct given `onDelete: Restrict` is intentional, but it does mean an admin can't tidy up master data by bulk-deleting a whole hierarchy in one step; they'd need to reassign/delete dependents first.

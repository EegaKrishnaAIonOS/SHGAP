# ADR-0028: Market-linkage dashboards (frontend) + real geo-activity map

- **Status:** Accepted
- **Date:** 2026-07-27
- **Sprint:** Sprint 4 (T19)

## Context

T19 wires the six dashboard pages (District/ULB/SHG/Product/Buyer/Government — built as static wireframes in T04/Sprint 0) up to T18's real analytics APIs, adds district/ULB/category/date filters, drill-down, PDF/Excel export, and an interactive demand/activity heat map. It depends on T18 (ADR-0027).

Two things shaped this before any frontend code was written:

- **The wireframe dashboards were pure mock data with no API calls, no loading/error states, and hardcoded single-row selections** (`districts[0]`, `shgs[2]`, etc.) — every page needed a genuine rewrite, not a patch. The 6 dashboard routes in `App.tsx` were also **ungated** (no `ProtectedRoute`/`RequireRole`), despite T18's endpoints already enforcing RBAC server-side — a real, exploitable gap (an unauthenticated visitor would see a login-walled _API_ fail per-tile, but the route itself rendered).
- **Real geo-tagged data is sparse: 3 SHGs and 4 buyers, one lat/lng each** — ~6 real points platform-wide. This directly shaped the heat-map decision below.

## Decision

**Discrete, real-value-scaled circle markers (Leaflet + free OpenStreetMap tiles), not a smoothed heat-density layer or Mapbox GL.** A true heatmap surface would visually imply a density gradient that six real points don't support — fabricating a smooth gradient over that little data would break this project's running "state the real gap, don't fabricate" pattern (ADR-0022/0023/0024/0026/0027). `react-leaflet@^4.2.1` (not v5, which requires React 19 — this app is pinned to React 18.3.1) renders `CircleMarker` (a vector marker, not `Marker`) specifically to sidestep Leaflet's well-known default-icon-path-under-bundlers issue, which only affects the pin-image `Marker`. Mapbox GL was rejected outright — it needs an API key/account, an unnecessary setup cost for a POC when free OSM tiles need none. `GovernmentDashboardPage` renders two maps (SHG sales activity, buyer recommendation activity) rather than one mixed map, since the two point sets carry different value semantics (₹ sales vs. recommendation count) that a single shared color/scale would blur together.

**One new backend endpoint (`GET /analytics/geo/activity`) added directly to T18's existing `analytics` module**, not a new module and not a proxy to ml-services' existing-but-frontend-unreachable H3 `hotspots.py`. It reuses `shg.location`/`buyers.location` (`ST_X`/`ST_Y`, matching `GeoService`'s own convention for PostGIS columns Prisma can't model) joined live against `mv_sales_facts`/`mv_recommendation_facts` — no new materialized view, for the same reason ADR-0027 didn't materialize the SHG/buyer dimension tables: single-digit row counts make a live join cheap.

**`useAsyncData` (`lib/useAsyncData.ts`) is the first shared data-fetching hook in the codebase.** Every dashboard needed the identical fetch/loading/error/cancelled-flag shape already used inline in `AdminProductsPage.tsx` (T09) — six near-identical copy-pastes were the alternative; generalizing the existing pattern once was the smaller change.

**`DashboardFilters` was rewritten from a non-functional placeholder into a fully controlled component** (`dateRange`/`onDateRangeChange` + an `extra: DashboardExtraFilter[]` array), driving a real refetch on every page. A new `dateRangeToDateFrom()` helper converts the UI's `30d`/`90d`/`12m` choice into the `dateFrom` the T18 endpoints accept.

**Export is real, generated client-side** — `jspdf` + `jspdf-autotable` for PDF, `xlsx` (SheetJS) for Excel — not a server-side export endpoint. Both take a small `ExportColumn<T>[]` (plain-value accessor, distinct from `DataTable`'s JSX-returning `render`, since export formats can't render React nodes). `xlsx`'s known CVEs are specifically about parsing untrusted uploaded files; this app only ever _generates_ its own files from its own already-fetched data, so that risk doesn't apply.

**RBAC gating fix: all 6 dashboard routes are now wrapped in `ProtectedRoute` + `RequireRole roles={ADMIN_PORTAL_ROLES}`**, reusing the exact role list (`ADMIN`/`STATE_OFFICIAL`/`DISTRICT_OFFICIAL`/`ULB_OFFICIAL`) the admin portal (T09) already defines, closing the pre-existing gap noted above.

**Dashboard pages are lazy-loaded (`React.lazy` + `Suspense`), not imported eagerly in `App.tsx`.** `leaflet` + `jspdf` + `xlsx` pushed the main JS bundle to 2.14 MB, past `vite-plugin-pwa`'s default 2 MiB workbox precache limit — a real production build failure, not a warning. Raising `workbox.maximumFileSizeToCacheInBytes` would have papered over the real problem: those libraries are official-dashboard-only and have no business bloating the _SHG-member-facing_ mobile PWA's app-shell precache, which is the thing that actually needs to stay small for offline/flaky-connectivity use. Code-splitting dropped the main chunk to ~817 KB with the heavy libs isolated into their own on-demand chunk.

## Real findings from verification

- **`GET /analytics/sales/categories`, `/analytics/sales/districts`, `/analytics/sales/ulbs`, `/analytics/sales/trend`, and `/analytics/recommendations/summary` were silently ignoring the `districtId`/`ulbId` query filters** — a genuine T18 bug, not a T19 regression, caught by curling these endpoints directly with a real admin JWT and cross-checking the results against `mv_sales_facts` queried directly in Postgres (Anantapur has exactly one category — "Pickles" — but the "filtered" response kept returning all 5 statewide categories). Root cause: the shared `dateAndCategoryConditions()` helper only ever applied `dateFrom`/`dateTo`/`categoryId`, never `districtId`/`ulbId` — `scopeConditions()` covers an _official's own jurisdiction_ (from the JWT), which is a separate concern from an ADMIN/STATE_OFFICIAL explicitly drilling into one district via the query string. `shgs()`/`products()`/`buyers()` already handled this correctly inline; the fix (renamed to `dateAndScopeConditions()`, now applies district/ULB/category uniformly) brings the other five endpoints in line with that existing, correct pattern. Two regression tests were added (`analytics.service.spec.ts`) asserting the generated SQL actually contains `district_id =`/`ulb_id =` when those filters are passed. Without this fix, every dashboard's district/ULB filter dropdown — the literal thing T19 asks for — would have silently shown state-wide numbers no matter what a user selected.
- **`GET /analytics/sales/ulbs` still legitimately returns `[]` against real data** (already documented in ADR-0027) — no real SHG has a `ulbId` set. `UlbDashboardPage`'s ULB-breakdown table and ULB filter dropdown are correctly empty today; this is real pilot data, not a bug introduced here.
- All new endpoint responses were cross-checked against `mv_sales_facts`/`mv_recommendation_facts` queried directly via `psql` — not just "the endpoint returns 200."

## Alternatives Considered

- **A smoothed heat-density map layer** — rejected; visually fabricates a density gradient six real points don't support.
- **Mapbox GL** — rejected; needs an API key/account for no benefit over free OSM tiles at this scale.
- **Proxying ml-services' H3 `hotspots.py`** — rejected; adds a cross-service dependency and H3-bucket semantics the frontend doesn't need when a live join over single-digit dimension tables is already cheap.
- **Raising the workbox precache size limit** instead of code-splitting — rejected; treats the symptom, not the cause, and keeps bloating the mobile PWA app-shell precache every time a future dashboard feature adds another heavy library.
- **Server-side PDF/Excel generation** — rejected; the data is already fetched client-side for the on-screen table, and both `jspdf`/`xlsx` are lightweight enough (now code-split) to generate the file in the browser directly.

## Known Gap

No browser-automation tooling (Playwright/Puppeteer, a connected browser MCP) is available in this environment. Verification here covers: every backend endpoint exercised end-to-end with a real admin JWT and real data (catching and fixing the filter bug above), full `lint`/`test`/`build` green for both `apps/web` and `apps/core-api`, and the dev server confirmed serving every dashboard route. Actual on-screen rendering, chart/map display, and interactive filter/export clicks have **not** been visually confirmed in a real browser — flagged explicitly rather than claimed.

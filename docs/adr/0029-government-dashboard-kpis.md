# ADR-0029: Government dashboard KPIs, rankings, and market-linkage panels

- **Status:** Accepted
- **Date:** 2026-07-28
- **Sprint:** Sprint 4 (T20)

## Context

T20 (Module 7 — Government Dashboard) asks for three groups of additions to `GovernmentDashboardPage.tsx` (which T19 already wired up with real district data, a recommendation-status pie chart, and the two Leaflet activity maps): KPI tiles (registered SHGs, products, uptime, satisfaction, enquiries generated); a state demand heatmap plus buyer-activity and market-linkage panels; and district-ranking, product-performance and recommendation-success panels. It depends only on T18 — not T15 (forecasting) — which matters for the heatmap decision below.

Two of the five requested KPIs — **uptime** and **satisfaction** — have no real backing data anywhere in this codebase, confirmed by direct inspection before writing any UI:

- **Uptime**: no Prometheus/Grafana/Loki deployment exists despite ADR-0014 planning one (that's Sprint 5/6 scope) — the only "health" surface is a static `{status:'ok'}` liveness check with no stored metric or historical percentage.
- **Satisfaction**: no survey/rating/feedback field exists anywhere in `schema.prisma` — no `Recommendation.rating`, no buyer/SHG feedback model, nothing.

## Decision

**Uptime is real but narrow, not fabricated as an SLA figure.** `GET /health` now returns `uptimeSeconds: process.uptime()` — genuinely real (time since the current core-api process started), explicitly labeled "API uptime" with a caveat ("Since last deploy — no SLA monitoring yet") rather than presented as a platform-wide availability percentage the platform doesn't actually track. This keeps the KPI tile honest about what it is and isn't.

**Satisfaction is shown with an explicit "not tracked yet" state, not a fabricated score.** The tile renders `—` with a caveat line ("Not tracked yet — no survey data exists") instead of inventing a plausible-looking percentage. This is the same choice ADR-0027 made for the wireframe's fabricated "members" count — state the real gap rather than paper over it.

**"State demand heatmap" reuses T19's existing real actual-sales geo-activity map — it does not proxy ml-services' forecasting or `hotspots.py`.** T20 depends only on T18, and no core-api-reachable "forecasted demand by district" endpoint exists today: ml-services' `/forecast/demand` is per-_product_ only (no district dimension), and `/hotspots` is real H3-binned _past sales_, not a forecast, despite its name — either would need new backend work T20 doesn't call for. The existing `/analytics/geo/activity` map already shows real demand/activity signal (SHG sales, buyer recommendation activity) at exactly the scale the pilot's ~6 real geo-tagged points support (ADR-0028). Building a second, forecast-based heatmap for a task scoped at 3 person-days and dependent only on T18 would be scope creep beyond what's asked.

**Market-linkage and recommendation-success are both served by one extended `recommendationSummary()` — not two separate new endpoints.** Two real, already-persisted fields were sitting unused on `mv_recommendation_facts`: `match_score` (a 0-1 confidence score from T17's heuristic blend) and the ability to count distinct SHG/buyer IDs by status. The single endpoint now returns, alongside the existing status breakdown and acceptance rate: `avgMatchScore` (recommendation _quality_, feeding the recommendation-success panel) and `shgsLinked`/`buyersLinked` — distinct SHGs/buyers with at least one ACCEPTED recommendation (linkage _coverage_, feeding the market-linkage panel). Both run as one extra parallel query (`Promise.all`, matching T19's `geoActivity` precedent) rather than a second cache-aside round-trip.

**"Enquiries generated" is a new, small `GET /analytics/enquiries/summary` endpoint** — total buyer enquiries by status (`OPEN`/`RESPONDED`/`CLOSED`), aggregated from `mv_enquiry_facts` (built for T18, never surfaced as a state-wide total until now). It mirrors `recommendationSummary`'s exact shape/pattern rather than inventing a new one.

**District-ranking and product-performance need no new backend work at all.** `districtSales()` already sorts by `total_amount DESC` and `products()` already sorts by revenue — both are just fetched and rendered with an added client-side rank number (`row index + 1`), not a new sort/endpoint.

**"Registered SHGs" and "products" KPI tiles reuse the existing paginated `getShgs()`/`getProducts()` calls (`pageSize: 1`, reading `.total`)** rather than adding a new admin-summary-style endpoint — this keeps the KPI tiles respecting the same district-filter drill-down as the rest of the page, which a fixed `/admin/summary` call would not.

## Real findings from verification

- **Zero real enquiries exist platform-wide** (`SELECT count(*) FROM enquiries` → 0) — confirmed directly via `psql`, not assumed. The "enquiries generated" KPI tile honestly shows 0; this is real pilot data, not a bug.
- **`avgMatchScore` = 0.582, `shgsLinked` = 1, `buyersLinked` = 1** against real data (out of 3 SHGs / 4 buyers total) — cross-checked against the same single ACCEPTED recommendation verified during T17/T19 testing in this same environment.
- All new/extended endpoints were exercised end-to-end with a real admin JWT against the running core-api after these changes, not just type-checked.

## Alternatives Considered

- **Fabricating an uptime percentage or a satisfaction score** to fill every requested KPI tile — rejected outright, per this project's consistent ADR-0022–0028 "state the real gap, don't fabricate" pattern.
- **Proxying ml-services' `/hotspots` or `/forecast/demand` into core-api for a "true" demand heatmap** — rejected for this task; out of T20's stated T18-only dependency and scope, and neither endpoint actually provides a per-district forecast today regardless.
- **A separate `/analytics/market-linkage` endpoint** distinct from `recommendationSummary` — rejected; the linkage-coverage and match-score fields are cheap additions to a query that already scans the same view, and splitting them would mean two cache-aside round trips for data the page always fetches together.

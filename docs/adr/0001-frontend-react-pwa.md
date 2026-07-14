# ADR-0001: Frontend on React + TypeScript as an installable PWA

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
SHG members are largely mobile-only, on entry-level Android devices with intermittent connectivity, and need Telugu-first UI with minimal typing. Officials need data-dense dashboards on desktop. The same codebase must serve both, ship a component library once (T04), and support offline product registration in weak-network villages (T07).

## Decision
Build a single React + TypeScript app (Vite build) delivered as a Progressive Web App: installable, offline-tolerant via a service worker + IndexedDB queue, responsive from phone to desktop, styled with Tailwind, localized with react-i18next (Telugu/English).

## Alternatives Considered
- **Native Android/iOS apps** — better device integration, but doubles build effort and delays a 90-day POC; excluded because a PWA already covers camera, mic and offline needs.
- **Server-rendered (Next.js) app** — helps SEO/initial load, irrelevant for an internal/registered-user platform; adds hosting complexity not needed for this pilot.
- **Flutter Web** — single codebase across mobile/web too, but the team's React/TS expertise and the ecosystem of dashboard/chart/map libraries (ECharts, Leaflet) are stronger on React.

## Consequences
- Positive: one codebase for SHG UI + all dashboards + admin; offline queue directly reuses IndexedDB in the browser; PWA install works without app-store friction.
- Trade-offs: PWA mic/background capabilities are more limited than a native app (acceptable for a pilot); service-worker caching adds complexity to the build pipeline (T04).

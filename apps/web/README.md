# @shgap/web

React + TypeScript + Vite frontend for the SHG Smart Market Linkage Platform
(MEPMA, Andhra Pradesh). This package delivers **T04 — Design system & UI
wireframes** on top of the bare scaffold from T03.

## IMPORTANT: wireframes are code, not Figma

Figma was not accessible from the environment this task was built in. Every
screen listed under [Wireframe routes](#wireframe-routes) is a **real,
routed React page** built from the component library below — structurally
real (routing, layout, forms, tables, charts all work), but intentionally
low-fidelity: content is placeholder/mock data, there are no API calls, and
visual polish is deliberately minimal. Every wireframe page also renders a
`Wireframe screen — placeholder content...` banner at runtime so this is
obvious even without reading this file. **Do not mistake this for a missing
Figma deliverable** — it is the deliverable, just produced in code because
Figma wasn't an option. Final visual design, real data and API wiring are
explicitly out of scope here and land in T06+.

## Getting started

```bash
# from the repo root
npm install
npm run dev --workspace=@shgap/web       # start the Vite dev server
npm run build --workspace=@shgap/web     # tsc -b && vite build -> dist/
npm run lint --workspace=@shgap/web      # eslint src
npm run preview --workspace=@shgap/web   # preview the production build
```

## Design tokens & Tailwind theme

Tailwind CSS was not previously installed in this app — it has been added
from scratch (Tailwind v3, classic `tailwind.config.ts` + PostCSS, not the
v4 CSS-first config, so the theme lives in one typed, importable file
rather than scattered `@theme` blocks).

- **Tokens**: [`src/design-tokens.ts`](./src/design-tokens.ts) is the single
  source of truth for colour, spacing, typography and shadow values
  (plain exported `const` objects, framework-agnostic).
- **Theme**: [`tailwind.config.ts`](./tailwind.config.ts) imports those
  tokens into `theme.extend`, so `bg-brand-400`, `text-neutral-700`,
  `min-h-touch`, `font-telugu`, `shadow-card`, etc. all resolve back to the
  same values as `design-tokens.ts`.
- **PostCSS**: [`postcss.config.js`](./postcss.config.js) wires
  `tailwindcss` + `autoprefixer` into the Vite build.
- **Global styles**: [`src/index.css`](./src/index.css) has the
  `@tailwind` directives, self-hosted font `@import`s, and a small `@layer
base` (body font/colour, heading weights, a visible focus ring).

Key tokens:

| Token group                                                  | Notes                                                                                                                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors.brand` / `colors.sky`                                | Purple/blue accents taken from the existing brand mark (`public/favicon.svg`), not a new competing palette.                                                                            |
| `colors.neutral` / `success` / `warning` / `danger` / `info` | Semantic scale used for status pills, alerts, chart series.                                                                                                                            |
| `spacing.touch` (`touch-sm` / `touch` / `touch-lg`)          | 44 / 48 / 56px tap targets — used throughout the SHG-facing (mobile) screens for accessibility given low-end-Android, low-digital-literacy users.                                      |
| `fontFamily.sans`                                            | Noto Sans stack — default UI font (English + numerals + official/admin screens).                                                                                                       |
| `fontFamily.telugu`                                          | Noto Sans Telugu stack — auto-applied via `html[lang="te"] body { @apply font-telugu }` in `index.css` whenever the language toggle switches to Telugu (`useHtmlLangSync`, see below). |

### Fonts

Fonts are **self-hosted** via `@fontsource/noto-sans` and
`@fontsource/noto-sans-telugu` (imported in `src/index.css`), not loaded
from Google Fonts at runtime. This was a deliberate call: SHG members are
often on low-end phones with patchy connectivity, and a PWA should not
depend on an external font CDN being reachable, especially offline.

## Component library (`src/components/ui/`)

All components are typed function components, keyboard-operable, and use
the design tokens above (no ad-hoc colours). A tiny local `cn()` helper
(`src/lib/cn.ts`) replaces `clsx` to avoid an extra dependency.

| Component                                                                                     | File               | Notes                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                                                      | `Button.tsx`       | Variants `primary/secondary/outline/ghost/danger`; sizes `sm/md/lg/touch` (the `touch` size is the 48px floor for SHG screens); `isLoading`, `leftIcon`/`rightIcon`, `fullWidth`.                                                                                                         |
| `Input`, `Select`                                                                             | `Input.tsx`        | Labelled, `hint`/`error` text wired to `aria-describedby`, `aria-invalid`, `fieldSize="md"\|"touch"`.                                                                                                                                                                                     |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `StatCard` | `Card.tsx`         | Compound card + a ready-made KPI tile (`StatCard`) used across every dashboard.                                                                                                                                                                                                           |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `DataTable<T>`     | `Table.tsx`        | Low-level primitives plus a generic typed `DataTable` (pass `columns` + `rows`) for the common dashboard/admin case.                                                                                                                                                                      |
| `Modal`                                                                                       | `Modal.tsx`        | Accessible dialog: `role="dialog"`, `aria-modal`, focus trap + Tab/Shift+Tab cycling, closes on Escape or backdrop click, restores focus to the trigger on close, rendered via `createPortal`.                                                                                            |
| `ChartWrapper`, `SimpleBarChart`, `SimpleLineChart`, `SimplePieChart`                         | `ChartWrapper.tsx` | **Recharts**-based. `ChartWrapper` supplies the common chrome (title/description/`ResponsiveContainer`/empty state) around any Recharts chart; the three `Simple*Chart` presets are the ones actually used on the dashboard pages. `CHART_COLORS` gives a consistent categorical palette. |

Import from the barrel: `import { Button, Card, DataTable } from "./components/ui"`.

Two supporting, non-"ui" components:

- `src/components/LanguageToggle.tsx` — the EN/TE switch (see i18n below).
- `src/components/PageHeader.tsx`, `src/components/DashboardFilters.tsx`,
  `src/components/WireframeBanner.tsx` — shared chrome for the
  dashboard/admin pages (title+subtitle+wireframe banner, a non-functional
  filter bar, and the wireframe disclosure banner respectively).

## Internationalisation (`src/i18n/`)

`react-i18next` + `i18next`, with `i18next-browser-languagedetector` for
persistence.

- `src/i18n/index.ts` — initialises i18next with **bundled** (not
  network-fetched) resources, `fallbackLng: "en"`, and
  `detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] }`
  so a member's language choice survives reloads/offline use. Resources are
  synchronous, so `useSuspense` is disabled — no Suspense boundary needed.
- `src/i18n/locales/en.json`, `src/i18n/locales/te.json` — full English and
  **real Telugu** translations (not English duplicated) for every UI string
  introduced in this task, grouped by namespace (`common`, `nav`, `home`,
  `registration`, `catalogue`, `voice`, `dashboard`, and one namespace per
  dashboard/admin page for titles/subtitles).
- `src/i18n/useHtmlLangSync.ts` — a hook (used once, in `App.tsx`) that
  keeps `<html lang>` in sync with the active i18next language. This is
  what drives the Telugu font-stack switch in `index.css`.
- `src/components/LanguageToggle.tsx` — the visible EN/తె toggle, placed in
  both app shells' top bars.

### Adding a new UI string

1. Add the key to `src/i18n/locales/en.json` under the right namespace (or
   a new one if it's a new page).
2. Add the **same key path** with a Telugu translation to
   `src/i18n/locales/te.json`. Don't leave it defaulted to English —
   reviewers should be able to tell at a glance if a key is missing its
   Telugu value.
3. Use it in a component with `const { t } = useTranslation(); t("namespace.key")`.
   For interpolation, use `t("registration.stepLabel", { current, total })`
   with `"stepLabel": "Step {{current}} of {{total}}"` in the JSON.

## Wireframe routes (`src/pages/`, routed from `App.tsx`)

Two layouts wrap the pages, chosen per the bimodal-user split called out in
the task brief:

- **`src/layouts/MobileShell.tsx`** — SHG-member-facing: single-column,
  centred content, a top bar with just the app name + language toggle, and
  a bottom tab bar with large icon+label targets (no hamburger menu — first
  -time smartphone users shouldn't have to discover a hidden menu).
- **`src/layouts/DashboardShell.tsx`** — official-facing: a persistent
  left sidebar nav on desktop (collapses behind a `☰` toggle only on small
  viewports), a wide `max-w-7xl` content area, and data-dense KPI/table/chart
  layouts instead of mobile-cramped ones.

| Route                    | Page component                                 | Shell                   | Represents                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                      | `pages/HomePage.tsx`                           | (none — its own layout) | Not a task deliverable screen; a reviewer index linking to every route below so the wireframes can be browsed without knowing the URLs.                                                      |
| `/register`              | `pages/shg/RegistrationPage.tsx`               | Mobile                  | SHG onboarding: 3-step flow (group details → location → phone/OTP verification + photo upload), large touch targets, no password.                                                            |
| `/catalogue`             | `pages/shg/ProductCataloguePage.tsx`           | Mobile                  | Product catalogue: search box + voice-search shortcut into the assistant, category chips, 2-column product card grid.                                                                        |
| `/voice-assistant`       | `pages/shg/VoiceAssistantPage.tsx`             | Mobile                  | Voice assistant: oversized mic button, tappable "quick command" suggestions, chat-style transcript. Speech capture is stubbed — the real ASR/voice-service pipeline is a later sprint.       |
| `/dashboards/district`   | `pages/dashboards/DistrictDashboardPage.tsx`   | Dashboard               | Module 5 — District dashboard: one district's KPIs, sales trend, category mix, ULB-wise table.                                                                                               |
| `/dashboards/ulb`        | `pages/dashboards/UlbDashboardPage.tsx`        | Dashboard               | Module 5 — ULB dashboard: one ULB's KPIs, orders trend, SHG-wise table with status pills.                                                                                                    |
| `/dashboards/shg`        | `pages/dashboards/ShgDashboardPage.tsx`        | Dashboard               | Module 5 — SHG dashboard: single-SHG monitoring profile, sales trend, product table.                                                                                                         |
| `/dashboards/product`    | `pages/dashboards/ProductDashboardPage.tsx`    | Dashboard               | Module 5 — Product dashboard: catalogue-wide top-products bar chart, category pie, full product table.                                                                                       |
| `/dashboards/buyer`      | `pages/dashboards/BuyerDashboardPage.tsx`      | Dashboard               | Module 5 — Buyer dashboard: buyer KPIs, orders-by-buyer-type chart, buyer table.                                                                                                             |
| `/dashboards/government` | `pages/dashboards/GovernmentDashboardPage.tsx` | Dashboard               | Module 7 — Government (MEPMA HQ / state-level) dashboard: state-wide KPIs, district comparison chart, a labelled **map placeholder** (no mapping library wired up yet), full district table. |
| `/admin`                 | `pages/admin/AdminPage.tsx`                    | Dashboard               | Admin: users table with roles/status, an "Invite user" flow that exercises the `Modal` component end-to-end, feature-flag toggles, content-moderation queue table.                           |

All dashboard/admin pages pull placeholder numbers from
`src/pages/dashboards/mockData.ts` so the figures are at least internally
consistent across screens (e.g. the district table sums roughly line up
with the state-level totals on the government dashboard). Nothing here
calls an API — that's T06+.

## PWA (manifest + service worker)

Configured via `vite-plugin-pwa` in `vite.config.ts`:

- `registerType: "autoUpdate"` — the plugin injects the manifest `<link>`
  and the SW registration script into `index.html` automatically; no
  manual `virtual:pwa-register` wiring was needed for this stage.
- **Manifest**: name/short_name/description, `display: "standalone"`,
  `theme_color`/`background_color` matching the brand tokens, and two
  placeholder icons — `public/pwa-192x192.png` and `public/pwa-512x512.png`
  (simple generated "SHG" wordmark squares; **not final iconography**, just
  enough for an installable manifest at wireframe stage).
- **Service worker**: Workbox-generated at build time; precaches the built
  app shell (`globPatterns: ["**/*.{js,css,html,svg,png,woff2}"]`) and
  runtime-caches same-origin GET requests with `StaleWhileRevalidate`, so
  the SHG-facing screens keep rendering on flaky connections. `devOptions.enabled`
  is `false` — the SW only runs in a production build/preview, not `npm run dev`.
- `index.html` also gets a `theme-color` meta tag and an `apple-touch-icon`.

To see the SW in action: `npm run build --workspace=@shgap/web && npm run preview --workspace=@shgap/web`.

## What was deliberately deferred / simplified

This is a Sprint-0 wireframe/scaffold deliverable, not a finished product:

- **No backend calls anywhere.** All dashboard/catalogue/admin data is local
  mock data in-file or in `mockData.ts`.
- **No real voice capture.** The mic button toggles local UI state and a
  couple of quick-command chips fake a transcript; the actual ASR/voice
  pipeline is a separate service integration.
- **No real map.** The government dashboard has a clearly labelled
  placeholder box instead of a GeoJSON/Leaflet/Mapbox district heat-map.
- **No auth/session.** The admin "Invite user" modal doesn't send email;
  there's no login screen (out of scope for T04).
- **Icons are placeholders.** The PWA icons are generated wordmark squares,
  not final iconography from a design pass.
- **No dark-mode toggle**, even though the token file could support one —
  `darkMode: "media"` is set in `tailwind.config.ts` for future use, but no
  component currently exposes a manual switch.

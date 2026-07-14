# Database (T02 — Sprint 0)

Prisma schema, migrations and master-data seed scripts for the SHG Smart Market Linkage Platform, per [ADR-0016](../docs/adr/0016-orm-prisma.md) (Prisma) and [ADR-0004](../docs/adr/0004-database-postgres-postgis-pgvector.md) (PostgreSQL 16 + PostGIS + pgvector).

This is a standalone package for now; T03 (repo scaffold) will fold it into the mono-repo as a shared package consumed by `core-api`.

## Local setup

Requires Docker Desktop. No official image ships both PostGIS and pgvector, so `Dockerfile.postgres` layers `postgresql-16-pgvector` onto the official `postgis/postgis:16-3.4` image.

```bash
cd database
docker compose up -d --build       # Postgres 16 + PostGIS 3.4 + pgvector 0.8, on host port 55432
cp .env.example .env                # if not already present
npm install
npm run migrate:deploy              # applies prisma/migrations/20260714000000_init
npm run generate                    # generates the Prisma client
npm run seed                        # seeds roles, districts, ULBs, mandals, categories, festival calendar
```

> **Port note:** the container publishes on **55432**, not the default 5432 — this machine already runs a native PostgreSQL instance on 5432. Adjust `DATABASE_URL` in `.env` if your setup differs.

Verified clean-apply: the migration was applied to a completely fresh `docker compose down -v && up -d` database with no errors (see T02 completion notes).

## Schema overview

21 tables across four areas — see [`prisma/schema.prisma`](prisma/schema.prisma) for full field definitions and the [ER diagram](../docs/database/rendered/er-diagram.png) for relationships:

- **Identity & RBAC:** `users`, `roles`, `user_roles` (role assignments optionally scoped to a district/ULB for officials)
- **Master data:** `districts`, `ulbs`, `mandals`, `categories` (self-referencing taxonomy), `festival_calendar`
- **SHG Product Registry (Module 1) & Buyer Matching (Module 4):** `shg`, `products`, `product_images`, `buyers`, `buyer_category_interests`, `sales`, `enquiries`, `recommendations`
- **Notifications & DPDP compliance:** `notifications`, `consents`, `audit_log`

## PostGIS & pgvector

`shg.location`, `products.location` and `buyers.location` are `geometry(Point, 4326)`; `products.embedding` and `buyers.embedding` are `vector(768)`. Prisma models these as `Unsupported(...)` columns (its typed query layer doesn't cover PostGIS/pgvector types) — see [ADR-0016](../docs/adr/0016-orm-prisma.md). Consequences:

- Geo queries (`ST_DWithin`, "products near me", etc.) and vector similarity search (`<=>` operator) must go through `prisma.$queryRaw`/`$executeRaw`, not the generated client methods.
- GIST indexes on the three `location` columns and `ivfflat` (cosine) indexes on the two `embedding` columns are hand-written in the migration SQL, appended after Prisma's generated DDL — see the bottom of [`prisma/migrations/20260714000000_init/migration.sql`](prisma/migrations/20260714000000_init/migration.sql).
- The `ivfflat` index `lists` parameter (100) is a starting point for pilot-scale data; revisit once real embedding volumes from T17 are known.

## Seed data

[`seed/data.ts`](seed/data.ts) holds the source data; [`seed/index.ts`](seed/index.ts) upserts it (safe to re-run). Covers:

- 5 roles (SHG, ULB_OFFICIAL, DISTRICT_OFFICIAL, STATE_OFFICIAL, ADMIN)
- The 3 POC pilot districts (Anantapur, Krishna, Visakhapatnam) with 9 ULBs and 15 mandals
- A 5-branch, 22-node product category taxonomy matching the POC scope's five product ecosystems
- 7 festival calendar entries used as forecasting regressors (T14/T15) — **lunar-festival dates (Ugadi, Ramzan, Dasara, Diwali) are approximate placeholders and must be confirmed against an authoritative calendar before relying on them for forecasting**

## Adding a migration

```bash
# edit prisma/schema.prisma, then:
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > /tmp/next.sql
# hand-add any PostGIS/pgvector index or CHECK constraint SQL Prisma can't express
# move into prisma/migrations/<timestamp>_<name>/migration.sql, then:
npm run migrate:deploy
```

`prisma migrate dev` requires an interactive TTY and does not work in non-interactive shells/CI — use the `migrate diff` + `migrate deploy` flow above instead.

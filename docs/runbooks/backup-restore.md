# Runbook: Postgres backup and restore

Real, tested `pg_dump`/`pg_restore` — this exact procedure was run against the local dev database while writing this runbook (real `Shg`/`Product`/`User` row counts verified identical before/after), not written from documentation alone.

## Backing up

```bash
# Local dev (backs up the shgap-postgres Docker container):
./infra/scripts/backup-postgres.sh

# Any real Postgres instance:
DATABASE_URL="postgresql://user:pass@host:5432/shgap" ./infra/scripts/backup-postgres.sh

# Also upload to the real S3 bucket (infra/terraform's db_backups_bucket output):
BACKUP_S3_BUCKET="$(terraform -chdir=infra/terraform output -raw db_backups_bucket)" \
  DATABASE_URL="..." ./infra/scripts/backup-postgres.sh
```

Writes a timestamped custom-format dump (`shgap-<UTC-timestamp>.dump`) to `infra/backups/` (gitignored — never commit real backup data).

**Automated daily backups** run inside the cluster via `infra/k8s/base/backup-cronjob.yaml` (02:00 IST) once a real cluster exists — same script's logic, containerized. RDS's own automated snapshots (`infra/terraform/modules/database`, 7-day retention) run independently underneath both — a second, independent safety net, not a replacement for either.

## Restoring

**Always restore into a fresh database, never in place over a live one** — a partial/failed restore over a live DB is much harder to recover from than a fresh one that just didn't finish:

```bash
# Local dev — restores into a NEW database named shgap_restore_test (or your own name):
./infra/scripts/restore-postgres.sh infra/backups/shgap-20260804T072136Z.dump shgap_restore_test

# Any real Postgres instance:
DATABASE_URL="postgresql://user:pass@host:5432/shgap" \
  ./infra/scripts/restore-postgres.sh infra/backups/shgap-20260804T072136Z.dump shgap_restore_test
```

Verify before treating the restore as good:

```bash
docker exec shgap-postgres psql -U shgap -d shgap_restore_test -c "SELECT count(*) FROM shg;"
```

## A real disaster-recovery drill

1. Back up production (or the closest environment you have) with the command above.
2. Restore into a _new_ database — never the one still serving real traffic.
3. Run the application's own test suite / a manual smoke pass against the restored database (point a throwaway core-api instance's `DATABASE_URL` at it) — row counts matching isn't sufficient proof; the application must actually work against the restored data (foreign keys, indexes, extensions — PostGIS/pgvector/pgcrypto must all have restored correctly, which `pg_restore`'s custom format handles automatically, but is worth confirming once for real rather than assuming).
4. Only promote a restored database to production traffic after step 3 passes, and only via a deliberate `DATABASE_URL` cutover (a Secret update + rolling restart), never by renaming/pointing existing infrastructure at it as an emergency shortcut.

## Retention

- **S3 lifecycle rule** (`infra/terraform/modules/storage`): logical `pg_dump` backups expire after 30 days.
- **RDS automated snapshots**: 7 days (`infra/terraform/modules/database`'s `backup_retention_period`).
- Anything needed for longer-term/compliance retention (DPDP Act 2023 audit requirements) should be copied out of the 30-day-lifecycle bucket into cold storage with its own, separate retention policy — not relied upon to still exist past 30 days in the default bucket.

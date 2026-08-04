#!/usr/bin/env bash
# T24/ADR-0033: real restore, tested against a real dump produced by
# backup-postgres.sh (see docs/runbooks/backup-restore.md) — restores into
# a FRESH database by default, never overwriting a live one in place,
# since a partial/failed restore over a live DB is much harder to recover
# from than a fresh one that just didn't finish.
#
# Usage:
#   ./restore-postgres.sh <dump-file> [target-db-name]
#   ./restore-postgres.sh ../backups/shgap-20260804T120000Z.dump shgap_restore_test
set -euo pipefail

DUMP_FILE="${1:?Usage: restore-postgres.sh <dump-file> [target-db-name]}"
TARGET_DB="${2:-shgap_restore_test}"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Restoring into a real Postgres instance's '$TARGET_DB' database..."
  psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS $TARGET_DB;"
  psql "$DATABASE_URL" -c "CREATE DATABASE $TARGET_DB;"
  # Same connection, different dbname — reuses the URL's host/user/password.
  TARGET_URL="$(echo "$DATABASE_URL" | sed -E "s#/[a-zA-Z0-9_]+(\?.*)?\$#/$TARGET_DB#")"
  pg_restore --dbname="$TARGET_URL" --no-owner --clean --if-exists "$DUMP_FILE"
else
  echo "No DATABASE_URL set — restoring into the local dev container's '$TARGET_DB' database..."
  docker exec shgap-postgres psql -U shgap -d shgap -c "DROP DATABASE IF EXISTS $TARGET_DB;"
  docker exec shgap-postgres psql -U shgap -d shgap -c "CREATE DATABASE $TARGET_DB;"
  docker exec -i shgap-postgres pg_restore -U shgap -d "$TARGET_DB" --no-owner --clean --if-exists \
    < "$DUMP_FILE"
fi

echo "Restored into '$TARGET_DB'. Verify with:"
echo "  docker exec shgap-postgres psql -U shgap -d $TARGET_DB -c 'SELECT count(*) FROM shg;'"

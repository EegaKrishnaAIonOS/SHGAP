#!/usr/bin/env bash
# T24/ADR-0033: real, runnable Postgres logical backup — `pg_dump` in
# custom format (`-Fc`), so `pg_restore` can do a selective/parallel
# restore rather than replaying a giant plain-SQL file line by line. This
# is the day-to-day, restore-tested backup story docs/runbooks/
# backup-restore.md walks through; RDS's own automated snapshots
# (infra/terraform/modules/database) are the point-in-time-recovery safety
# net underneath it, not a replacement for actually being able to restore a
# specific dump to a specific point in time on demand.
#
# Usage:
#   ./backup-postgres.sh                     # backs up the local dev DB (via docker exec)
#   DATABASE_URL=postgresql://... ./backup-postgres.sh   # backs up any real Postgres instance
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="shgap-$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Backing up $DATABASE_URL to $BACKUP_DIR/$FILENAME..."
  pg_dump --format=custom --file="$BACKUP_DIR/$FILENAME" "$DATABASE_URL"
else
  echo "No DATABASE_URL set — backing up the local dev container (shgap-postgres)..."
  docker exec shgap-postgres pg_dump -U shgap -d shgap --format=custom \
    > "$BACKUP_DIR/$FILENAME"
fi

SIZE="$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)"
echo "Wrote $BACKUP_DIR/$FILENAME ($SIZE)"

# Real deployment: upload to the S3 bucket infra/terraform/modules/storage
# provisions for exactly this (db_backups_bucket output) — commented out
# rather than run unconditionally, since this script's local-dev callers
# have no AWS credentials and shouldn't need any to back up their own
# laptop's Postgres.
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "Uploading to s3://$BACKUP_S3_BUCKET/$FILENAME..."
  aws s3 cp "$BACKUP_DIR/$FILENAME" "s3://$BACKUP_S3_BUCKET/$FILENAME"
fi

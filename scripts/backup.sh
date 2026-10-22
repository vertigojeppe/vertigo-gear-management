#!/bin/sh
# Nightly backup of the production stack: database dump + uploads, in one archive,
# kept locally for BACKUP_KEEP_DAYS and copied off-site with rclone when BACKUP_REMOTE is set.
#
#   ./scripts/backup.sh                 # writes backups/vertigo-gear-YYYYMMDD-HHMM.tar.gz
#   BACKUP_REMOTE=r2:vertigo-backups ./scripts/backup.sh
#
# Cron (every night at 03:10, from the repository directory):
#   10 3 * * * cd /opt/vertigo-gear && ./scripts/backup.sh >> backups/backup.log 2>&1
#
# Restore with ./scripts/restore.sh <archive>.
set -eu

cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
NAME="vertigo-gear-$STAMP"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$BACKUP_DIR"

echo "[$STAMP] dumping database"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-vertigo}" -d "${POSTGRES_DB:-vertigo_gear}" --no-owner --no-privileges > "$WORK/db.sql"

echo "[$STAMP] copying uploads"
# The uploads volume is read through the app container so no host path is assumed.
docker compose exec -T app tar -C /data -cf - uploads > "$WORK/uploads.tar"

cp .env.example "$WORK/env.example" 2>/dev/null || true
echo "$NAME" > "$WORK/VERSION"
git rev-parse HEAD > "$WORK/GIT_COMMIT" 2>/dev/null || true

tar -C "$WORK" -czf "$BACKUP_DIR/$NAME.tar.gz" .
SIZE="$(du -h "$BACKUP_DIR/$NAME.tar.gz" | cut -f1)"
echo "[$STAMP] wrote $BACKUP_DIR/$NAME.tar.gz ($SIZE)"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  echo "[$STAMP] copying to $BACKUP_REMOTE"
  rclone copy "$BACKUP_DIR/$NAME.tar.gz" "$BACKUP_REMOTE/" --quiet
  rclone delete "$BACKUP_REMOTE/" --min-age "${KEEP_DAYS}d" --quiet || true
fi

find "$BACKUP_DIR" -name 'vertigo-gear-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "[$STAMP] done"

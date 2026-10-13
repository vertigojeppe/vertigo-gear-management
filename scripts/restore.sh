#!/bin/sh
# Restore a backup made by scripts/backup.sh. Replaces the database and the uploads.
#
#   ./scripts/restore.sh backups/vertigo-gear-20261013-0310.tar.gz
#
# The app is stopped while the data is swapped and started again afterwards, so
# migrations run on the restored database if the code moved on since the backup.
set -eu

ARCHIVE="${1:?usage: restore.sh <archive.tar.gz>}"
cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env
DB_USER="${POSTGRES_USER:-vertigo}"
DB_NAME="${POSTGRES_DB:-vertigo_gear}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

tar -C "$WORK" -xzf "$ARCHIVE"
[ -f "$WORK/db.sql" ] || { echo "no db.sql in $ARCHIVE"; exit 1; }
echo "restoring $(cat "$WORK/VERSION" 2>/dev/null || echo "$ARCHIVE") (code at $(cat "$WORK/GIT_COMMIT" 2>/dev/null || echo '?'))"

printf 'This replaces the database "%s" and all uploads. Type yes to continue: ' "$DB_NAME"
read -r answer
[ "$answer" = "yes" ] || { echo "aborted"; exit 1; }

echo "stopping the app"
docker compose --profile prod stop app

echo "recreating the database"
docker compose exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" -c "CREATE DATABASE \"$DB_NAME\";"
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$WORK/db.sql"

if [ -f "$WORK/uploads.tar" ]; then
  echo "restoring uploads"
  # Through a throwaway container on the same volume: the app is stopped.
  docker compose run --rm --no-deps --entrypoint sh app -c 'rm -rf /data/uploads && mkdir -p /data/uploads' >/dev/null
  docker compose run --rm --no-deps -T --entrypoint sh app -c 'tar -C /data -xf -' < "$WORK/uploads.tar"
fi

echo "starting the app (migrations run on start)"
docker compose --profile prod up -d app
echo "done"

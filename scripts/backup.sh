#!/usr/bin/env bash
# Back up GK's MongoDB to ./backups/gk-<date>.archive.gz (TRACEN guide §01: automate backups).
# Uses the "mongo" service from docker-compose.yml. Keeps the newest $KEEP backups (default 14).
#
#   ./scripts/backup.sh
#
# Schedule it daily on the host, e.g. with cron:
#   15 2 * * *  cd /path/to/Calude && ./scripts/backup.sh >> backups/backup.log 2>&1
# and copy ./backups somewhere off this machine (cloud storage), or a dead disk takes the backups too.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${DB:-personal_assistant}"
KEEP="${KEEP:-14}"
CONTAINER="${CONTAINER:-$(docker compose ps -q mongo)}"
mkdir -p backups
FILE="backups/gk-$(date -u +%Y%m%d-%H%M%S).archive.gz"

docker exec "$CONTAINER" mongodump --quiet --db="$DB" --archive --gzip > "$FILE"
SIZE=$(wc -c < "$FILE")
if [ "$SIZE" -lt 100 ]; then
  echo "Backup looks empty ($SIZE bytes): $FILE" >&2
  exit 1
fi
echo "Backup written: $FILE ($SIZE bytes)"

# Rotate: keep the newest $KEEP archives.
ls -1t backups/gk-*.archive.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f

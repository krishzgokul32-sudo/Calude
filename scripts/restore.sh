#!/usr/bin/env bash
# Restore a GK backup made by backup.sh.
#
#   ./scripts/restore.sh backups/gk-20261107-021500.archive.gz            # into a test database (safe)
#   TARGET_DB=personal_assistant ./scripts/restore.sh <file> --replace    # over the live database
#
# Restoring into a separate test database first, and checking it, is how you test your backups
# (TRACEN guide §01: "backups don't restore"). Do it once a month.
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?usage: restore.sh <backup.archive.gz> [--replace]}"
SOURCE_DB="${SOURCE_DB:-personal_assistant}"
TARGET_DB="${TARGET_DB:-personal_assistant_restore_test}"
CONTAINER="${CONTAINER:-$(docker compose ps -q mongo)}"
DROP=""
if [ "${2:-}" = "--replace" ]; then
  read -r -p "This replaces database '$TARGET_DB'. Type the database name to continue: " ok
  [ "$ok" = "$TARGET_DB" ] || { echo "Cancelled."; exit 1; }
  DROP="--drop"
fi

docker exec -i "$CONTAINER" mongorestore --quiet --archive --gzip $DROP \
  --nsFrom="${SOURCE_DB}.*" --nsTo="${TARGET_DB}.*" < "$FILE"

echo "Restored into '$TARGET_DB'. Document counts:"
docker exec "$CONTAINER" mongosh --quiet "$TARGET_DB" --eval \
  'db.getCollectionNames().sort().forEach(c => print(c.padEnd(24), db[c].countDocuments()))'

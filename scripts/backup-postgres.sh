#!/usr/bin/env sh
# Dump PostgreSQL from the chatwoot compose stack
set -e
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$OUT_DIR/chatwoot_${STAMP}.sql.gz"
docker compose -f "$(dirname "$0")/../docker-compose.yml" exec -T postgres \
  pg_dump -U postgres chatwoot | gzip > "$FILE"
echo "Saved: $FILE"

#!/bin/sh
# entrypoint.sh — Backend container startup script
#
# Responsibilities:
#   1. Wait until PostgreSQL is ready to accept connections
#   2. Run Alembic migrations (creates tables on first start, applies new ones on updates)
#   3. Start the uvicorn application server
#
# This script ensures migrations always run before the API accepts traffic,
# preventing "relation does not exist" errors on fresh deployments.

set -e

echo "=== Society Food Platform Backend ==="
echo "Environment: ${ENVIRONMENT:-development}"

# ─── Wait for PostgreSQL ──────────────────────────────────────────────────────
# pg_isready is included in the postgresql-client package installed in Dockerfile.
# It exits 0 when the DB is accepting connections.

echo "[1/3] Waiting for PostgreSQL to be ready..."

until pg_isready -d "$DATABASE_URL" -q; do
  echo "  PostgreSQL is not ready yet — retrying in 2 seconds..."
  sleep 2
done

echo "  ✓ PostgreSQL is ready!"

# ─── Run Alembic Migrations ───────────────────────────────────────────────────
echo "[2/3] Running database migrations..."

alembic upgrade head

echo "  ✓ Migrations applied successfully"

# ─── Start Application Server ─────────────────────────────────────────────────
echo "[3/3] Starting uvicorn..."

# In development: use --reload for hot-reloading
# In production: use multiple workers (override CMD in prod compose)
if [ "${ENVIRONMENT}" = "production" ]; then
  WORKERS=${WORKERS:-4}
  echo "  Production mode: $WORKERS workers"
  exec uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "$WORKERS"
else
  echo "  Development mode: single worker with --reload"
  exec uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
fi

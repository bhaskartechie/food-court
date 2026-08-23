#!/bin/sh
# entrypoint.sh — Backend container startup script
#
# Responsibilities:
#   1. Wait until PostgreSQL is ready to accept connections
#   2. Run Alembic migrations (creates tables on first start, applies new ones)
#   3. Start the uvicorn application server
#
# This script runs inside the Docker container only.
# For local development, run uvicorn directly (see README).

set -e

echo "=== Society Food Platform Backend ==="
echo "Environment: ${ENVIRONMENT:-development}"
echo "Python path: ${PYTHONPATH:-/app}"

# ─── 1. Wait for PostgreSQL ───────────────────────────────────────────────────
echo ""
echo "[1/3] Waiting for PostgreSQL to be ready..."

until pg_isready -d "$DATABASE_URL" -q; do
  echo "  PostgreSQL not ready — retrying in 2 seconds..."
  sleep 2
done

echo "  ✓ PostgreSQL is ready!"

# ─── 2. Run Alembic Migrations ────────────────────────────────────────────────
echo ""
echo "[2/3] Running Alembic migrations..."

# Run from /app (backend root) so alembic.ini and migrations/ are found
alembic upgrade head

echo "  ✓ Migrations applied!"

# ─── 3. Start Application Server ──────────────────────────────────────────────
echo ""
echo "[3/3] Starting uvicorn (app.main:app)..."

if [ "${ENVIRONMENT}" = "production" ]; then
  WORKERS=${WORKERS:-4}
  echo "  Production mode: $WORKERS workers (no --reload)"
  exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "$WORKERS"
else
  echo "  Development mode: single worker with --reload"
  exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
fi

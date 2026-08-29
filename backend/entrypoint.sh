#!/bin/sh
# entrypoint.sh — Backend container startup script
#
# Responsibilities:
#   1. Wait until PostgreSQL is ready to accept connections (with timeout safeguards)
#   2. Pre-flight Alembic migration check & auto-upgrade (head)
#   3. Start the uvicorn application server
#

set -e

echo "========================================="
echo "=== Society Food Platform Backend v1.1 ==="
echo "========================================="
echo "Environment: ${ENVIRONMENT:-development}"
echo "Python path: ${PYTHONPATH:-/app}"

# ─── 1. Wait for PostgreSQL with Retry Limit ──────────────────────────────────
echo ""
echo "[1/3] Waiting for PostgreSQL to be ready..."

MAX_RETRIES=30
RETRY_COUNT=0

until pg_isready -d "$DATABASE_URL" -q || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  echo "  [Attempt $((RETRY_COUNT+1))/$MAX_RETRIES] PostgreSQL not ready — waiting 2 seconds..."
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "  ✗ ERROR: PostgreSQL connection timed out after $MAX_RETRIES attempts!"
  exit 1
fi

echo "  ✓ PostgreSQL connection established!"

# ─── 2. Run Alembic Migrations ────────────────────────────────────────────────
echo ""
echo "[2/3] Verifying and applying Alembic migrations..."

# Run from /app (backend root) so alembic.ini and migrations/ are found
if [ -f "alembic.ini" ]; then
  echo "  Applying: alembic upgrade head"
  alembic upgrade head || {
    echo "  ✗ ERROR: Alembic migration failed! Aborting startup to prevent schema corruption."
    exit 1
  }
  echo "  ✓ Database schema is up-to-date with head!"
else
  echo "  ℹ No alembic.ini found; running in standalone mode."
fi

# ─── 3. Start Application Server ──────────────────────────────────────────────
echo ""
echo "[3/3] Starting Application Server..."

if [ "${ENVIRONMENT}" = "production" ] || [ "${ENVIRONMENT}" = "staging" ]; then
  WORKERS=${WORKERS:-4}
  echo "  Server running in ${ENVIRONMENT} mode with $WORKERS worker processes."
  exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "$WORKERS" \
    --proxy-headers \
    --forwarded-allow-ips='*'
else
  echo "  Server running in development mode (hot-reload enabled)."
  exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
fi


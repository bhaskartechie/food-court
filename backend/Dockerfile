# Backend Dockerfile
#
# Works for both local development (via docker-compose) and production.
# PYTHONPATH is set to /app (the backend root), so all imports like
# `from app.main import app` and `from app.core.config import settings` resolve.

FROM python:3.12-slim

WORKDIR /app

# ── System dependencies ───────────────────────────────────────────────────────
# gcc       — required to compile some Python C extensions
# curl      — used by Docker HEALTHCHECK
# postgresql-client — provides pg_isready used in entrypoint.sh
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# ── Environment ───────────────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# ── Python dependencies ───────────────────────────────────────────────────────
# Copy requirements first to leverage Docker layer cache —
# changing app code won't re-install packages.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Entrypoint ────────────────────────────────────────────────────────────────
# Copy entrypoint to the root filesystem (/entrypoint.sh) so that a
# bind-mount of /app does NOT overwrite it during development.
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r//' /entrypoint.sh && chmod +x /entrypoint.sh

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# ── Port ─────────────────────────────────────────────────────────────────────
EXPOSE 8000

# ── Health check ─────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ── Start ─────────────────────────────────────────────────────────────────────
CMD ["/bin/sh", "-c", "/entrypoint.sh"]

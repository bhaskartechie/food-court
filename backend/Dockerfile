# Backend Dockerfile — Development-optimised single stage
#
# Key changes from original:
#  - Single-stage build (multi-stage caused issues with volume-mount + non-root user)
#  - curl installed for health check
#  - postgresql-client installed for pg_isready in entrypoint.sh
#  - entrypoint.sh copied to /entrypoint-fixed.sh (outside /app to avoid bind-mount override)
#  - PYTHONPATH set to /app so all imports resolve correctly

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Copy Python dependencies first (layer cache optimisation)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entrypoint script to root filesystem (outside /app bind mount scope)
COPY entrypoint.sh /entrypoint-fixed.sh
# Fix Windows CRLF line endings and make executable
RUN sed -i 's/\r//' /entrypoint-fixed.sh && chmod +x /entrypoint-fixed.sh

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check using curl (installed above)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run fixed entrypoint from root (not affected by bind mount)
CMD ["/bin/sh", "-c", "/entrypoint-fixed.sh"]

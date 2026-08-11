# Backend Dockerfile — Development-optimised single stage
#
# Key changes from original:
#  - Single-stage build (multi-stage caused issues with volume-mount + non-root user)
#  - curl installed for health check
#  - postgresql-client installed for pg_isready in entrypoint.sh
#  - entrypoint.sh used as CMD (runs migrations before uvicorn)
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

# Copy and install Python dependencies first (layer cache optimisation)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Strip Windows CRLF line endings from entrypoint.sh (safe on Linux too)
RUN sed -i 's/\r//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8000

# Health check using curl (installed above)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run entrypoint (waits for DB → runs migrations → starts uvicorn)
CMD ["/app/entrypoint.sh"]

# Frontend Dockerfile — Multi-stage build for React + Nginx
#
# Key changes from original:
#  - Removed non-root appuser setup (it conflicted with nginx permissions)
#  - nginx runs as its default user (handles permissions for pid, logs, etc.)
#  - Health check uses the correct port (80)

# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --silent

# Copy source code and build
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Remove the default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the built React app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

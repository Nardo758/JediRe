# Multi-stage Dockerfile for JEDI RE Backend
FROM node:18-alpine AS base

# Install dependencies for building
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

WORKDIR /app

# ================================
# Backend Build Stage
# ================================
FROM base AS backend-builder

# Copy backend package files
COPY backend/package*.json ./backend/
WORKDIR /app/backend

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy backend source
COPY backend/ .

# Build TypeScript
RUN npm run build

# ================================
# Frontend Build Stage
# ================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy frontend source
COPY frontend/ .

# Build frontend
RUN npm run build

# ================================
# Production Stage
# ================================
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl

WORKDIR /app

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/package.json
COPY --from=backend-builder /app/backend/scripts ./backend/scripts
COPY --from=backend-builder /app/backend/migrations ./backend/migrations

# Copy built frontend (for serving if needed)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy root package.json
COPY package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "run", "start:prod"]

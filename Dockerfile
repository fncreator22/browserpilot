# syntax=docker/dockerfile:1
# §PRODUCTION MULTI-STAGE DOCKERFILE
# Stage 1: Dependency installation & Prisma Client generation
# Stage 2: Next.js 16 standalone build
# Stage 3: Minimal runtime with Playwright Chromium OS dependencies & BullMQ worker

# ==============================================================================
# Stage 1: Dependencies & Prisma Generation
# ==============================================================================
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Install native compilation dependencies for bcrypt / node-gyp / openssl
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Clean dependency install
RUN npm ci

# Generate Prisma Client for PostgreSQL
RUN npx prisma generate

# ==============================================================================
# Stage 2: Next.js 16 Standalone Build
# ==============================================================================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy cached dependencies and generated Prisma client
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compile Next.js with output: "standalone"
RUN npm run build

# ==============================================================================
# Stage 3: Production Runner (Next.js + BullMQ + Headless Chromium)
# ==============================================================================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install system dependencies required for headless Chromium execution
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    wget \
    gnupg \
    procps \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-liberation \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set up Playwright Chromium browser directory
RUN mkdir -p /ms-playwright && \
    npx playwright install chromium && \
    chown -R nextjs:nodejs /ms-playwright

# Copy standalone web application artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and engines for runtime data operations
COPY --from=builder /app/prisma ./prisma

# Copy worker daemon modules, libraries, and configs for background execution
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy and configure entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && \
    mkdir -p /app/storage/artifacts && \
    chown -R nextjs:nodejs /app/storage

# Switch to non-root execution
USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]

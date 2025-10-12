# ----------------------------
# Stage 1 — Dependencies
# ----------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files and install deps
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# ----------------------------
# Stage 2 — Build Next.js app
# ----------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build Next.js app
RUN pnpm run build

# ----------------------------
# Stage 3a — Web app container
# ----------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built app from builder
COPY --from=builder /app ./

# Expose web port
EXPOSE 3000

# Start Next.js
CMD ["pnpm", "start"]

# ----------------------------
# Stage 3b — Cron worker container
# ----------------------------
FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy source + node_modules
COPY --from=builder /app ./

# Run the worker directly with tsx (no separate compilation needed)
CMD ["npx", "tsx", "src/server/worker/cronWorker.ts"]
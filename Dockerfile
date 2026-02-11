# ----------------------------
# Stage 1: Base - Setup pnpm and workspace
# ----------------------------
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.16.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ----------------------------
# Stage 2: Dependencies - Install and cache all dependencies
# ----------------------------
FROM base AS deps
WORKDIR /app

# Copy only package files for better caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/errors/package.json ./packages/errors/
COPY packages/services/package.json ./packages/services/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/web/package.json ./apps/web/

# Install dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

# ----------------------------
# Stage 3: Builder - Build the application
# ----------------------------
FROM base AS builder
WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/errors/node_modules ./packages/errors/node_modules
COPY --from=deps /app/packages/services/node_modules ./packages/services/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY . .

# Build shared packages first, then web
ENV SKIP_ENV_VALIDATION=true
ENV DATABASE_URL=postgres://stub/stub
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm turbo build --filter=@onescope/web

# ----------------------------
# Stage 4: Runner - Production image
# ----------------------------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.16.0 --activate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy workspace files for pnpm deploy
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/errors/package.json ./packages/errors/
COPY --from=builder /app/packages/services/package.json ./packages/services/
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/ui/package.json ./packages/ui/
COPY --from=builder /app/packages/utils/package.json ./packages/utils/
COPY --from=builder /app/apps/web/package.json ./apps/web/

# Install only production dependencies using pnpm deploy
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# Copy built packages
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/errors/dist ./packages/errors/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/services/dist ./packages/services/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/types/dist ./packages/types/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/ui/dist ./packages/ui/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/utils/dist ./packages/utils/dist

# Copy built Next.js application (standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD pnpm --filter @onescope/web start -H 0.0.0.0

# ----------------------------
# Stage 1 — Build
# ----------------------------
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace metadata FIRST
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps ./apps

# Install all deps (workspace-aware)
RUN pnpm install --frozen-lockfile

# Skip env validation during build (env vars provided at runtime)
ENV SKIP_ENV_VALIDATION=true
ENV DATABASE_URL=postgres://stub/stub

# Build
RUN pnpm turbo build

# ----------------------------
# Stage 2 — Runtime
# ----------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps ./apps

# Install all deps (including devDeps for drizzle-kit migrations)
RUN pnpm install --frozen-lockfile

# Copy built output from builder
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD sh -c "pnpm drizzle-kit migrate && pnpm --filter @onescope/web start -H 0.0.0.0"
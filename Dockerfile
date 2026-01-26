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

# Build
RUN pnpm turbo build

# ----------------------------
# Stage 2 — Runtime
# ----------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only what runtime needs
COPY --from=builder /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps

# Copy built output
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD sh -c "pnpm drizzle-kit migrate && pnpm --filter @onescope/web start -H 0.0.0.0"
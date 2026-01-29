# ----------------------------
# Stage 1 — Build
# ----------------------------
FROM node:20-bookworm AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

ENV SKIP_ENV_VALIDATION=true
ENV DATABASE_URL=postgres://stub/stub

# Build ONLY the web app (but deps are built via turbo)
RUN pnpm --filter @onescope/web build


# ----------------------------
# Stage 2 — Runtime
# ----------------------------
FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production

# pnpm IS REQUIRED for next start
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy everything needed to run
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages

# Install production deps only
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD pnpm --filter @onescope/web start -H 0.0.0.0
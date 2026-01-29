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

RUN pnpm turbo build --filter=@onescope/web
RUN pnpm deploy --filter @onescope/web --prod /out


# ----------------------------
# Stage 2 — Runtime
# ----------------------------
FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /out /app

EXPOSE 3000
CMD node apps/web/server.js
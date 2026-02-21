# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN npm install -g pnpm@10.16.0

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.json ./
COPY apps/web ./apps/web
COPY packages/db ./packages/db
COPY packages/errors ./packages/errors
COPY packages/services ./packages/services
COPY packages/types ./packages/types
COPY packages/ui ./packages/ui
COPY packages/utils ./packages/utils

RUN pnpm install --frozen-lockfile

FROM deps AS builder
ENV SKIP_ENV_VALIDATION=true
ENV DATABASE_URL=postgres://stub/stub
ENV BETTER_AUTH_SECRET=docker-build-secret

RUN pnpm turbo build --filter=@onescope/web...

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN npm install -g pnpm@10.16.0

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db ./packages/db
RUN pnpm install --prod --frozen-lockfile --filter @onescope/db...

WORKDIR /app

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

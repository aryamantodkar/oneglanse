# syntax=docker/dockerfile:1.7

FROM node:20-bookworm AS base
WORKDIR /app
ARG PNPM_VERSION=10.16.0
RUN npm install -g pnpm@${PNPM_VERSION}

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.json ./
COPY apps/agent ./apps/agent
COPY packages/db ./packages/db
COPY packages/errors ./packages/errors
COPY packages/services ./packages/services
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils

RUN pnpm install --frozen-lockfile

FROM deps AS builder
RUN pnpm turbo build --filter=@oneglanse/agent...
RUN pnpm deploy --filter @oneglanse/agent --prod /app/out
RUN cd /app/out && npx playwright install chromium

FROM node:20-bookworm-slim AS runner
ARG PNPM_VERSION=10.16.0

# Playwright system deps
RUN apt-get update && apt-get install -y \
  libnss3 \
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
  libasound2 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  ca-certificates \
  fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

RUN npm install -g pnpm@${PNPM_VERSION}

COPY --from=builder /app/out ./
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

CMD ["pnpm", "start:worker"]

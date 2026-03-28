# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
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

FROM node:20-bookworm-slim AS runner
ARG PNPM_VERSION=10.16.0
ARG CAMOUFOX_PIP_SPEC
ARG CAMOUFOX_BROWSER_CHANNEL

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  python3-pip \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0 libdbus-glib-1-2 \
  libx11-xcb1 libxt6 \
  ca-certificates \
  fontconfig \
  xvfb \
  fonts-noto-core fonts-noto-color-emoji \
  && fc-cache -f \
  && test -n "${CAMOUFOX_PIP_SPEC}" \
  && test -n "${CAMOUFOX_BROWSER_CHANNEL}" \
  && python3 -m pip install --no-cache-dir --break-system-packages \
    "${CAMOUFOX_PIP_SPEC}" \
  && python3 -m camoufox set "${CAMOUFOX_BROWSER_CHANNEL}" \
  && python3 -m camoufox fetch \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV CAMOUFOX_PYTHON_BIN=python3

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=builder /app/out ./
COPY apps/agent/docker/start-worker.sh /usr/local/bin/start-worker
RUN chmod +x /usr/local/bin/start-worker

RUN chown -R node:node /app

CMD ["/usr/local/bin/start-worker"]

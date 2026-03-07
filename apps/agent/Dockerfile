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

# Browser runtime deps + Xvfb for headful mode (eliminates headless fingerprint signals)
# System fonts are critical — VPS by default has almost no fonts, which creates
# a distinctive font-enumeration fingerprint that bot-detection systems recognise.
# We install real Google Chrome (not Chromium) because Chrome has a different
# TLS/JA3 fingerprint that matches anti-bot allowlists. Chromium's BoringSSL
# build uses different cipher suites and gets flagged.
RUN apt-get update && apt-get install -y --no-install-recommends \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0 \
  ca-certificates \
  fontconfig \
  wget gnupg \
  xvfb \
  fonts-liberation fonts-dejavu fonts-freefont-ttf \
  fonts-noto fonts-noto-cjk-extra fonts-noto-color-emoji \
  fonts-roboto \
  fonts-crosextra-carlito fonts-crosextra-caladea \
  && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/google-chrome-stable

RUN google-chrome-stable --version

RUN npm install -g pnpm@${PNPM_VERSION}

COPY --from=builder /app/out ./

# Startup script: launch Xvfb virtual display then start the worker.
# Chrome runs in headful mode against the virtual display, eliminating all
# headless-specific browser fingerprint signals (outerHeight=0, LLVMpipe WebGL, etc.)
RUN printf '#!/bin/sh\n\
mkdir -p /storage/profiles /tmp/oneglanse-profiles\n\
Xvfb :99 -screen 0 3840x2160x24 -ac -nolisten tcp &\n\
XVFB_PID=$!\n\
export DISPLAY=:99\n\
# Give Xvfb a moment to initialise before Chrome tries to connect\n\
sleep 1\n\
# exec replaces this shell — signals (SIGTERM) go directly to the worker\n\
exec pnpm start:worker\n' > /start-worker.sh && chmod +x /start-worker.sh

RUN chown -R node:node /app

CMD ["/start-worker.sh"]

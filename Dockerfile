# ----------------------------
# Stage 1 — Build
# ----------------------------
FROM node:20-bookworm AS builder
WORKDIR /app

# Install pnpm via npm (more resilient than corepack which depends on registry.npmjs.org)
RUN npm install -g pnpm@10.16.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

ENV SKIP_ENV_VALIDATION=true
ENV DATABASE_URL=postgres://stub/stub

# Build the web app AND its dependencies via turbo
RUN pnpm turbo build --filter=@onescope/web


# ----------------------------
# Stage 2 — Runtime
# ----------------------------
FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@10.16.0

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

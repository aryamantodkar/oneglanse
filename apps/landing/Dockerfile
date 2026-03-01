FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/landing/package.json apps/landing/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter @oneglanse/landing build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public
EXPOSE 3000
CMD ["node", "apps/landing/server.js"]

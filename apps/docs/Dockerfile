FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/docs/package.json apps/docs/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter @oneglanse/docs build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
COPY --from=builder /app/apps/docs/.next/standalone ./
COPY --from=builder /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=builder /app/apps/docs/public ./apps/docs/public
EXPOSE 3002
CMD ["node", "apps/docs/server.js"]

# ----------------------------
# Stage 1 — Build the Next.js app
# ----------------------------
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Skip env validation (if using @t3-oss/env-nextjs)
ENV SKIP_ENV_VALIDATION=true

# Build Next.js
RUN pnpm build

# ----------------------------
# Stage 2 — Production runtime
# ----------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only what's needed
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/.env ./.env

EXPOSE 3000

CMD ["pnpm", "start", "-H", "0.0.0.0"]
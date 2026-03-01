# Quick Start

## 1. Install dependencies

```bash
pnpm install
```

## 2. Configure runtime variables

- Fill root `.env`
- Fill `apps/agent/.env`

Use only the keys listed in the Environment Variables section.

## 3. Start infra services

```bash
docker compose up -d postgres clickhouse redis
```

## 4. Start the app stack

```bash
pnpm dev:web
pnpm dev:agent
```

## 5. Start marketing/docs apps (optional)

```bash
pnpm --filter @oneglanse/landing dev
pnpm --filter @oneglanse/docs dev
```

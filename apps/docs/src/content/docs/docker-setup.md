# Docker Setup

## Core services

Use Docker Compose to run the stateful services:

- PostgreSQL
- ClickHouse
- Redis

```bash
docker compose up -d
```

## App containers

Build each app independently for isolation:

- `apps/web` for dashboard API/UI
- `apps/agent` for workers
- `apps/landing` for marketing site
- `apps/docs` for documentation site

Each app has an independent Next.js standalone build output.

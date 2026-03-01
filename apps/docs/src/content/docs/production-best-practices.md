# Production Best Practices

## Isolation

- Keep `apps/web`, `apps/agent`, `apps/landing`, and `apps/docs` as separate deployables.
- Scale worker replicas independently from web traffic.

## Reliability

- Use process restarts and health checks.
- Keep Redis persistent enough for queue recovery.
- Monitor ClickHouse insert failures and mutation lag.

## Security

- Store env secrets in server secret manager.
- Restrict Redis/Postgres/ClickHouse to private network.
- Rotate `BETTER_AUTH_SECRET`, `INTERNAL_CRON_SECRET`, and `API_AUTH_TOKEN` periodically.

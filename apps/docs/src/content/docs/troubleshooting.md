# Troubleshooting

## Jobs stuck in pending

- Check Redis connectivity and credentials.
- Verify agent workers are running and connected to the same Redis instance.

## No analysis data

- Confirm `OPENAI_API_KEY` is set in root `.env`.
- Check ClickHouse write permissions and table health.

## Internal schedule not firing

- Confirm `INTERNAL_CRON_SECRET` and `API_BASE_URL` are valid in root `.env`.
- Verify schedule exists and worker service is healthy.

## Proxy failures

- Validate `PROXY_SOURCE_MODE` and source-specific variable.
- Replace low-quality proxies and rerun.

## Docs page returns 404 behind Nginx

- If `apps/docs` uses `basePath: /docs`, do not use a trailing slash in `proxy_pass`.
- Correct:
  - `location /docs/ { proxy_pass http://127.0.0.1:3002; }`
- Incorrect:
  - `location /docs/ { proxy_pass http://127.0.0.1:3002/; }`

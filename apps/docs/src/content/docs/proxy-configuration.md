# Proxy Configuration

## Modes

`PROXY_SOURCE_MODE` controls proxy sourcing:

- API mode with `PROXY_API_URL`
- Manual file mode with `PROXY_MANUAL_FILE`

## Runtime behavior

- Proxy records are scored per outcome.
- Failed proxies enter cooldown.
- Worker cycles rotate proxies on repeated failures.
- Successful proxies are reused until degraded.

## Required settings

```env
PROXY_SOURCE_MODE=
PROXY_API_URL=
PROXY_MANUAL_FILE=
```

Use one source path that matches the chosen mode.

# @oneglanse/agent

Agent consumes provider jobs from Redis/BullMQ. It drives the product interfaces in a browser, extracts responses and citations, persists them through `@oneglanse/services`, and triggers response analysis.

## Main entry points

- `src/index.ts`: worker process lifecycle.
- `src/worker.ts`: provider queue consumers and execution gate.
- `src/worker/jobHandler.ts`: provider job execution.
- `src/core/providers/`: provider-specific browser behavior.
- `src/lib/browser/`: browser runtime.

## Development

From the repository root, run `pnpm --filter @oneglanse/agent dev` to start the worker. Use `pnpm --filter @oneglanse/agent test` for its tests.

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the system boundary and [environment variables](../../docs/environment-variables.mdx) for user configuration.

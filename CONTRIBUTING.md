# Contributing to OneGlanse

Thanks for helping improve OneGlanse. Read [ARCHITECTURE.md](ARCHITECTURE.md) for system boundaries and [AGENTS.md](AGENTS.md) for change rules. Code and tests define the current behavior.

## Set up locally

Use Node.js 20 or newer, pnpm 10.16.0, and Docker with Compose. Fork the repository and branch from `main`.

```bash
git clone https://github.com/oneglanse/oneglanse.git
cd oneglanse
pnpm local
```

`pnpm local` installs dependencies, prepares the local browser runtime, starts PostgreSQL, ClickHouse, and Redis, runs migrations, and opens Web at `http://localhost:3000`. Use `pnpm auth` to sign in to providers through a local browser when that flow is needed.

CodeGraph is optional contributor tooling. Run `pnpm codegraph:init` to create its local index, then use `pnpm exec codegraph explore "question or symbol"` for call paths. Use `rg` for exact text searches.

## Find the owner

- `apps/web`: UI, authentication, tRPC routes, and access checks.
- `apps/agent`: provider browser automation and worker execution. Provider-specific behavior lives under `apps/agent/src/core/providers/<provider>/`.
- `packages/services`: reusable application behavior, queue submission, storage operations, and analysis.
- `packages/db`: database schema, migrations, and clients. `packages/types`, `packages/ui`, `packages/utils`, and `packages/errors` hold their named shared contracts and components.
- `apps/landing` and `docs`: the public site and operator docs.

## Change and verify behavior

Keep a PR focused on one coherent change. Read its direct callers and tests before editing. Add a regression test for a bug when practical. For provider DOM changes, use sanitized fixtures and describe the provider, prompt or scenario, expected result, and observed result. A live provider run is supplemental evidence when the external UI is the subject of the change; it must not be required by deterministic CI.

Run relevant focused checks while working. Before opening a PR, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm deadcode
pnpm build
```

CI runs the same repository checks. It also builds and tests finished Docker images on native AMD64 and ARM64 runners when relevant files change. Contributors do not need to reproduce that image matrix locally. For Docker packaging changes, inspect the runtime image checks rather than checking Dockerfile text alone.

In the PR, explain the behavior change and why it is needed, show the checks and observations that support it, and state any compatibility or deployment effect. Link an issue when one exists. Keep unrelated work out of the diff.

For a bug report, use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include the version or commit, OS, reproduction steps, expected and actual behavior, and relevant logs with secrets removed. Use [Discussions](https://github.com/oneglanse/oneglanse/discussions) for general questions.

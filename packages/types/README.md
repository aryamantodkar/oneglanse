# @oneglanse/types

Shared TypeScript contracts used across apps and packages.

## Responsibilities

- Define provider and agent payload/result contracts.
- Define analysis/metrics/source shape contracts.
- Define service argument/return contracts shared across workspaces.
- Prevent drift between web, worker, and service layers.

## Structure

- `src/types/agent.ts`: providers, prompt result contracts.
- `src/types/analysis.ts`: analysis record/analysis output contracts.
- `src/types/metrics.ts`: dashboard metrics primitives.
- `src/types/prompts.ts`: prompt entities.
- `src/types/sources.ts`: citation/source entities.
- `src/types/entities.ts`: core shared entities.
- `src/types/browser.ts`: browser-related shared contracts.
- `src/types/services.ts`: service-level shared contracts.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @oneglanse/types build` | Compile TypeScript |
| `pnpm --filter @oneglanse/types typecheck` | TypeScript checks |

## Usage

```ts
import type { Provider, AnalysisRecord } from "@oneglanse/types";
```

## Contribution Guidance

- Add new shared contracts here when used by multiple workspaces.
- Prefer adding/adjusting explicit types instead of `any` casts in consuming packages.
- Keep contracts backward-compatible when possible; when not, document migration notes in PRs.

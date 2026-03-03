# @oneglanse/utils

Shared helper utilities used across the monorepo.

## Responsibilities

- Common formatting and display helpers.
- URL/source/domain extraction and normalization helpers.
- Agent-specific selectors, retry/backoff, and detection helpers.
- Shared IDs, logging utilities, and CSV export helper logic.

## Module Areas

- `src/format/*`: date/text/markdown formatting helpers.
- `src/url/*`: URL parsing/normalization helpers.
- `src/extract/*`: source/domain aggregation helpers.
- `src/analysis/*`: analysis filtering helpers for consumers.
- `src/agent/*`: provider constants/selectors/retry helpers.
- `src/export/*`: CSV row building helpers.
- `src/workspace/*`: workspace code parsing helpers.
- `src/logger.ts`: shared logging wrappers.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @oneglanse/utils build` | Compile TypeScript |
| `pnpm --filter @oneglanse/utils typecheck` | TypeScript checks |

## Usage

```ts
import { formatDate, getDomain, filterAnalysisRecords } from "@oneglanse/utils";
```

## Contribution Guidance

- Keep helpers deterministic and side-effect minimal.
- Put domain orchestration in `@oneglanse/services`, not in utility functions.
- Prefer small focused modules with explicit named exports.

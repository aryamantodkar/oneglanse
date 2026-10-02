# @oneglanse/landing

Public marketing site for OneGlanse, deployed separately on Vercel.

## Responsibilities

- Explain what the product does and why it is open source.
- Show static dashboard previews with shared UI components.
- Link to the app and docs.

## Structure

- `src/app/page.tsx`: assembles landing sections.
- `src/components/sections/*`: major page sections.
- `src/components/previews/*`: visual product previews.
- `src/lib/landing-content.ts`: section copy/content model.
- `src/lib/preview-data.ts`: preview dataset used across components.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @oneglanse/landing dev` | Start Next.js dev server |
| `pnpm --filter @oneglanse/landing build` | Build production bundle |
| `pnpm --filter @oneglanse/landing start` | Start built app |
| `pnpm --filter @oneglanse/landing typecheck` | TypeScript checks |
| `pnpm --filter @oneglanse/landing lint` | Biome lint/check |

## Environment Variables

- No required runtime environment variables are currently defined for this app.
- `.env.example` is intentionally minimal.

## Local Development

```bash
pnpm --filter @oneglanse/landing dev
```

If port `3000` is already used by another app, run with a custom `PORT`.

## Dependencies

- `@oneglanse/ui`
- `@oneglanse/types`
- `@oneglanse/utils`

These keep landing previews aligned with the app.

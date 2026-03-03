# @oneglanse/docs

Nextra-based documentation site for deployment, operations, provider setup, and troubleshooting.

## Responsibilities

- Publish technical docs for self-hosting and production setup.
- Keep deployment guidance in sync with actual monorepo behavior.
- Provide contributor-editable MDX content with clear navigation.

## Structure

- `content/*.mdx`: documentation pages.
- `src/app/layout.tsx`: docs theme layout and metadata.
- `src/app/[[...mdxPath]]/page.tsx`: catch-all MDX route.
- `src/app/robots.ts` and `src/app/sitemap.ts`: crawler metadata.

## Important Routing Behavior

Configured in `next.config.js`:
- `basePath: "/docs"`
- `trailingSlash: true`

The app is expected to be served at `/docs`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @oneglanse/docs dev` | Start docs server on port `3002` |
| `pnpm --filter @oneglanse/docs build` | Build production docs |
| `pnpm --filter @oneglanse/docs start` | Start built docs on `3002` |
| `pnpm --filter @oneglanse/docs typecheck` | Next typegen + TS checks |
| `pnpm --filter @oneglanse/docs lint` | Biome lint/check |

## Environment Variables

- No required runtime env variables are currently defined for docs.
- `.env.example` is informational.

## Local Development

```bash
pnpm --filter @oneglanse/docs dev
```

Then open `http://localhost:3002/docs`.

## Current Content Pages

- `index.mdx`
- `getting-started.mdx`
- `architecture.mdx`
- `environment-variables.mdx`
- `providers.mdx`
- `proxy-setup.mdx`
- `self-hosting.mdx`
- `vps-deployment.mdx`
- `troubleshooting.mdx`

## Editing Docs

1. Add or edit files in `apps/docs/content`.
2. Keep examples and env names aligned with root `.env.example` and runtime behavior.
3. Validate with:

```bash
pnpm --filter @oneglanse/docs typecheck
pnpm --filter @oneglanse/docs build
```

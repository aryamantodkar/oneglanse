# Contributing to OneGlanse

I'm relatively new to open source. This is one of my first public projects. If you find something worth fixing or improving, I'd genuinely love a PR or even just an issue. Every bit of help makes this better.

Thank you for your interest in contributing. OneGlanse is MIT-licensed and fully open source.

## Ways to Contribute

- **Bug reports:** file a GitHub issue with reproduction steps
- **Feature requests:** open an issue to discuss before building
- **Code:** fix bugs, implement requested features, improve performance
- **Docs:** improve `docs/` or `README.md`

---

## Development Setup

**Requirements:** Node.js 20+, pnpm 10+, Docker + Docker Compose

```bash
git clone https://github.com/aryamantodkar/oneglanse
cd oneglanse
pnpm local
```

`pnpm local` installs dependencies if needed, then starts the full stack locally at `http://localhost:3000`.

### Project Structure

```
apps/
  web/          # Next.js 15 app (tRPC, Drizzle, Better Auth)
  agent/        # BullMQ worker for browser automation + response capture
packages/
  db/           # Drizzle schema, migrations, ClickHouse schema
  services/     # Shared business logic (LLM analysis, queue, redis)
  errors/       # Shared error types and Logger
  types/        # Shared TypeScript types
docs/           # Mintlify docs
```

### Useful Commands

```bash
pnpm local          # Start everything (web + agent + docker services)
pnpm typecheck      # Run typecheck across the monorepo
pnpm build          # Build all packages
pnpm db:migrate     # Run pending Drizzle migrations
pnpm auth           # Open /providers for interactive auth setup
```

---

## Making Changes

### Branching

- Fork the repo and create a branch from `main`
- Name branches descriptively: `fix/ai-overview-extraction`, `feat/export-csv`

### Code Style

- TypeScript throughout. Avoid `any` unless there's a genuine reason
- Match the style of the file you're editing
- No unnecessary abstractions. Solve the problem at hand
- Keep changes surgical: touch only what you must

### Commits

Write clear, present-tense commit messages:

```
Fix AI Overview extraction skipping clipped content
Add CSV export for source attribution data
Remove unused RateLimitError class
```

One commit per logical change. Avoid "WIP" or "fix2" commits. Squash before opening a PR if needed.

### Pull Requests

- Reference the issue your PR addresses: `Closes #123`
- Keep PRs focused: one feature or fix per PR
- Include a short description of what changed and why
- If you changed agent behavior, describe how you tested it

---

## Agent / Browser Automation

The agent (`apps/agent/`) runs Camoufox + Playwright to capture responses from real AI product UIs. When working in this area:

- Test with `CAMOUFOX_HEADLESS_MODE=headful` so you can see what the browser is doing
- Set `DEBUG_ENABLED=true` for verbose logs
- Provider-specific logic lives in `apps/agent/src/core/providers/<provider>/`
- DOM helpers live in `apps/agent/src/lib/browser/domOps.ts`

---

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.yml) template. Include:

- OneGlanse version or commit hash
- OS and Node.js version
- Steps to reproduce
- What you expected vs. what happened
- Relevant logs (set `DEBUG_ENABLED=true` for agent issues)

---

## Feature Requests

Open a [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml) issue before writing code. This avoids duplicate work and ensures the feature fits the project direction.

---

## Questions

For general questions, open a [Discussion](https://github.com/aryamantodkar/oneglanse/discussions) rather than an issue.

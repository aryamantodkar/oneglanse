# Changelog

All notable changes to OneGlanse will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [1.0.0] - 2026-04-19

Initial public release.

### Added
- ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview providers
- UI-first browser capture via Camoufox + Playwright: captures rendered responses, inline citations, and source attribution
- GEO scoring: visibility, sentiment, rank position, recommendation type: per prompt, over time
- Competitor co-mention tracking and citation source attribution
- AI perception analysis (pricing signal, key claims, brand framing) via OpenAI or Anthropic
- ClickHouse analytics backend for high-volume time-series prompt data
- PostgreSQL + Drizzle ORM for relational data (workspaces, prompts, users)
- BullMQ job queue for parallel provider workers
- Better Auth with email/password and optional Google OAuth
- `pnpm local`: single command local dev stack (Docker + migrations + browser runtime)
- `pnpm self-host`: single command VPS deployment
- Provider auth session upload from local machine to VPS (`pnpm upload:vps`)
- ThorData residential proxy support for VPS runs
- Claude API support for response analysis (`ANALYSIS_LLM_PROVIDER=claude`)
- AI Overview response extraction using `innerHTML` bypass for CSS-clipped content
- Open-source contribution infrastructure: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, issue templates, PR template
- VPS deployment guide with nginx, SSL, and provider auth upload
- `docs/environment-variables.mdx`: full environment variable reference
- `docs/troubleshooting.mdx`: common failure modes and fixes

### Changed
- Cloud mode removed: only `local` and `self-host` modes remain
- README rewritten with accurate product positioning and per-screenshot descriptions
- Docs simplified: introduction trimmed, api-reference cleaned to commands/routes/modes

### Fixed
- Redis service using raw `console.log`: replaced with structured Logger
- `.env.example` missing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ANTHROPIC_API_KEY`
- `ONEGLANSE_APP_MODE` default in `.env.example` corrected to `local`

### Removed
- Unused `RateLimitError` class
- SOCKS4/SOCKS5 proxy support: only HTTP/HTTPS CONNECT tunneling remains
- Dead mode-guard functions (`canAccessScheduleInMode`, `canAccessProvidersInMode`, `canRunPromptsNowInMode`)
- `mockData/` JSON files and `llm_results.json` purged from git history

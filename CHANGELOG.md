# Changelog

All notable changes to OneGlanse will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Claude API support for response analysis (`ANALYSIS_LLM_PROVIDER=claude`)
- AI Overview response extraction using `innerHTML` bypass for CSS-clipped content
- Open-source contribution infrastructure: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, issue templates, PR template
- `docs/environment-variables.mdx` — full environment variable reference
- `docs/troubleshooting.mdx` — common failure modes and fixes

### Changed
- README rewritten with accurate product positioning and per-screenshot descriptions
- Docs simplified: introduction trimmed, api-reference cleaned to commands/routes/modes

### Fixed
- Redis service using raw `console.log` — replaced with structured Logger
- `.env.example` missing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ANTHROPIC_API_KEY`
- `ONEGLANSE_APP_MODE` default in `.env.example` corrected to `local`

### Removed
- Unused `RateLimitError` class
- `mockData/` JSON files and `llm_results.json` purged from git history

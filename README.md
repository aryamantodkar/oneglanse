# OneGlanse

**Track how your brand appears inside real AI products — ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview.**

[App](https://app.oneglanse.com) · [Docs](https://docs.oneglanse.com) · [oneglanse.com](https://oneglanse.com)

---

<img src="docs/images/Mockup-1.png" width="100%" />

---

## The Problem

AI chat products don't use the same ranking signals as Google. When someone asks ChatGPT or Gemini to recommend a tool in your category, the answer depends on what those models know — and how prominently your brand appears in their responses.

Traditional SEO tools don't measure this. API-based LLM evals don't either — they return raw model output, not what users actually see inside ChatGPT or Perplexity.

OneGlanse runs your prompts inside the real UIs and captures exactly what a user sees: the rendered response, source citations, sentiment framing, and which competitors appear alongside you. Every run is stored, analyzed with your own LLM API key, and tracked over time.

---

<img src="docs/images/Mockup-2.png" width="100%" />

---

## Features

- **Multi-provider monitoring** — ChatGPT, Gemini, Perplexity, Claude, Google AI Overview
- **UI-first capture** — responses captured from real product interfaces, not raw model APIs
- **Visibility & GEO scoring** — rank position, mention rate, sentiment, recommendation type
- **Competitor co-mentions** — see which brands appear alongside yours and how they're framed
- **Source & citation tracking** — which URLs and domains the AI is citing for your category
- **Response analysis** — powered by your own OpenAI or Anthropic API key
- **ClickHouse analytics** — fast, high-volume storage built for time-series response data
- **Recurring scheduled runs** — automated prompt execution in self-host mode
- **Self-hostable** — deploy the full stack on any VPS with a single command

---

<img src="docs/images/Mockup-3.png" width="100%" />

---

## Your Data Stays Yours

OneGlanse uses your own provider accounts for browser authentication. Auth sessions are stored on your machine — never on an external server.

Response analysis calls go directly from your infrastructure to OpenAI or Anthropic using your own API keys. Analytics are stored in a ClickHouse instance you own and control.

The entire pipeline — browser automation, response capture, storage, and analysis — runs inside infrastructure you own and can fully audit. Open source, MIT licensed.

---

<img src="docs/images/Mockup-4.png" width="100%" />

---

## Quick Start

**Requirements:** Node.js 20+, pnpm 10+, Docker

```bash
git clone https://github.com/aryamantodkar/oneglanse
cd oneglanse
pnpm install
pnpm local
```

Opens at [http://localhost:3000](http://localhost:3000).

On first run the script handles everything: generates `.env`, starts Postgres / ClickHouse / Redis, runs database migrations, and bootstraps the Camoufox browser runtime. Once the app opens, go to `/providers` to connect your AI provider accounts.

For VPS self-hosting, provider auth setup, and all configuration options → **[docs.oneglanse.com](https://docs.oneglanse.com)**

---

## Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 15, React 19, tRPC, Drizzle ORM |
| Browser worker | Camoufox, Playwright, BullMQ |
| Analytics DB | ClickHouse |
| Relational DB | PostgreSQL 16 |
| Queue | Redis |
| Auth | Better Auth |
| Response analysis | OpenAI or Anthropic (your key) |

---

## Acknowledgements

OneGlanse is built on top of exceptional open source work. We're grateful to every project and contributor listed here.

### Browser Automation

| Project | Use | License |
|---|---|---|
| [Camoufox Browser](https://camoufox.com) | Anti-fingerprint Firefox-based browser used for all provider sessions | MPL-2.0 |
| [Playwright](https://github.com/microsoft/playwright) | Browser automation and page control | Apache-2.0 |

### Job Queue & Infrastructure

| Project | Use | License |
|---|---|---|
| [BullMQ](https://github.com/taskforcesh/bullmq) | Redis-backed job queue for provider workers | MIT |
| [ioredis](https://github.com/redis/ioredis) | Redis client | MIT |
| [PostgreSQL](https://www.postgresql.org) | Primary relational database | PostgreSQL License |
| [ClickHouse](https://github.com/ClickHouse/ClickHouse) | Analytics and time-series storage | Apache-2.0 |
| [Redis](https://redis.io) | Queue broker and cache | BSD-3-Clause |

### Web & API

| Project | Use | License |
|---|---|---|
| [Next.js](https://github.com/vercel/next.js) | Web application framework | MIT |
| [tRPC](https://github.com/trpc/trpc) | End-to-end type-safe API layer | MIT |
| [Better Auth](https://github.com/better-auth/better-auth) | Authentication framework | MIT |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) | TypeScript ORM for Postgres | Apache-2.0 |
| [Zod](https://github.com/colinhacks/zod) | Schema validation | MIT |
| [superjson](https://github.com/blitz-js/superjson) | Serialization for tRPC | MIT |

### UI

| Project | Use | License |
|---|---|---|
| [Radix UI](https://github.com/radix-ui/primitives) | Accessible UI primitives | MIT |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | Utility-first CSS framework | MIT |
| [Lucide](https://github.com/lucide-icons/lucide) | Icon library | ISC |
| [Sonner](https://github.com/emilkowalski/sonner) | Toast notifications | MIT |
| [React Hook Form](https://github.com/react-hook-form/react-hook-form) | Form state management | MIT |
| [next-themes](https://github.com/pacocoursey/next-themes) | Dark mode support | MIT |
| [class-variance-authority](https://github.com/joe-bell/cva) | Component variant styling | Apache-2.0 |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge) | Tailwind class merging | MIT |

### Content Processing

| Project | Use | License |
|---|---|---|
| [Turndown](https://github.com/mixmark-io/turndown) | HTML to Markdown conversion | MIT |
| [marked](https://github.com/markedjs/marked) | Markdown parsing | MIT |
| [sanitize-html](https://github.com/apostrophecms/sanitize-html) | HTML sanitization | MIT |

### LLM SDKs

| Project | Use | License |
|---|---|---|
| [OpenAI Node SDK](https://github.com/openai/openai-node) | Response analysis via OpenAI | Apache-2.0 |
| [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Response analysis via Claude | MIT |

### Tooling

| Project | Use | License |
|---|---|---|
| [TypeScript](https://github.com/microsoft/TypeScript) | Type-safe JavaScript | Apache-2.0 |
| [Biome](https://github.com/biomejs/biome) | Linter and formatter | MIT |
| [Turbo](https://github.com/vercel/turborepo) | Monorepo build system | MIT |
| [pnpm](https://github.com/pnpm/pnpm) | Package manager | MIT |

---

## License

MIT

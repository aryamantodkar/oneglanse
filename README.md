# OneGlanse

**Track how your brand appears inside real AI products — ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview.**

[App](https://app.oneglanse.com) · [Docs](https://docs.oneglanse.com) · [oneglanse.com](https://oneglanse.com)

---

<img width="100%" alt="OneGlanse Dashboard" src="https://github.com/user-attachments/assets/d5438aff-67bc-4556-baa8-939906a59c02" />

---

## The Problem

AI chat products don't use the same ranking signals as Google. When someone asks ChatGPT or Gemini to recommend a tool in your category, the answer depends on what those models know — and how prominently your brand appears in their responses.

Traditional SEO tools don't measure this. API-based LLM evals don't either — they return raw model output, not what users actually see inside ChatGPT or Perplexity.

OneGlanse runs your prompts inside the real UIs and captures exactly what a user sees: the rendered response, source citations, sentiment framing, and which competitors appear alongside you. Every run is stored, analyzed with your own LLM API key, and tracked over time.

---

<img width="100%" alt="OneGlanse Prompt Responses" src="https://github.com/user-attachments/assets/09fae3f5-4e3c-4920-9d19-c32d9a1da0d5" />

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

<img width="100%" alt="OneGlanse Source Intelligence" src="https://github.com/user-attachments/assets/caace32a-1e68-44e8-9b71-f582e9dc9de0" />

---

## Your Data Stays Yours

OneGlanse uses your own provider accounts for browser authentication. Auth sessions are stored on your machine — never on an external server.

Response analysis calls go directly from your infrastructure to OpenAI or Anthropic using your own API keys. Analytics are stored in a ClickHouse instance you own and control.

The entire pipeline — browser automation, response capture, storage, and analysis — runs inside infrastructure you own and can fully audit. Open source, MIT licensed.

---

<img width="100%" alt="OneGlanse Analytics" src="https://github.com/user-attachments/assets/aac7d04b-e7b9-4e58-b780-2afd33b6c960" />

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

| Project | Use | License |
|---|---|---|
| [Camoufox](https://github.com/daijro/camoufox) | Anti-fingerprint Firefox-based browser used for all provider sessions | MPL-2.0 |
| [Playwright](https://github.com/microsoft/playwright) | Browser automation and page control | Apache-2.0 |
| [BullMQ](https://github.com/taskforcesh/bullmq) | Redis-backed job queue for provider workers | MIT |
| [ClickHouse](https://github.com/ClickHouse/ClickHouse) | Analytics and time-series storage | Apache-2.0 |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) | TypeScript ORM | Apache-2.0 |
| [Better Auth](https://github.com/better-auth/better-auth) | Authentication framework | MIT |
| [Turndown](https://github.com/mixmark-io/turndown) | HTML to Markdown conversion | MIT |

---

## License

MIT

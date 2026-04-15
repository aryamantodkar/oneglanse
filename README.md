# OneGlanse

**The open-source GEO tracker.** Know exactly how your brand appears inside ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview — self-hosted, free forever, and your data never leaves your own infrastructure.

[App](https://app.oneglanse.com) · [Docs](https://docs.oneglanse.com) · [oneglanse.com](https://oneglanse.com)

---

<img width="100%" alt="OneGlanse Dashboard" src="https://github.com/user-attachments/assets/d5438aff-67bc-4556-baa8-939906a59c02" />

**Your GEO score, top competitor, rank position, and most-cited sources — in one view.** The dashboard shows your overall visibility across all AI models, which competitor co-appears most often alongside your brand, your average rank position, and which domains the AI products cite when your category comes up.

---

<img width="100%" alt="OneGlanse Prompt Responses" src="https://github.com/user-attachments/assets/09fae3f5-4e3c-4920-9d19-c32d9a1da0d5" />

**See exactly what AI says about you — and how it perceives you.** Every prompt response is captured from the real product UI (not a raw API call), scored for GEO, sentiment, visibility, and rank position. The perception panel extracts how models frame your brand: pricing signal, what you're best known for, and the specific claims they repeat most.

---

<img width="100%" alt="OneGlanse Source Intelligence" src="https://github.com/user-attachments/assets/caace32a-1e68-44e8-9b71-f582e9dc9de0" />

**Know which sources drive your AI presence — and how you stack up against competitors.** See every article and domain that's being cited about your brand, with the exact page titles. The competitor chart tracks where you sit against rivals across Presence, Recommendation, and Sentiment.

---

<img width="100%" alt="OneGlanse Analytics" src="https://github.com/user-attachments/assets/aac7d04b-e7b9-4e58-b780-2afd33b6c960" />

**Per-prompt performance, not just averages.** Every prompt you track gets its own GEO score, sentiment, visibility percentage, and rank position — so you know exactly which queries you own and which ones you're losing.

---

## Features

- **5 providers** — ChatGPT, Gemini, Perplexity, Claude, Google AI Overview
- **UI-first capture** — responses captured from the real product interface, not model APIs. What you see is what users see.
- **GEO scoring** — visibility, sentiment, rank position, and recommendation type tracked per prompt over time
- **Competitor co-mentions** — see which brands appear alongside yours and how they're framed
- **Citation tracking** — which domains and articles the AI is citing for your category
- **AI perception analysis** — how models frame your pricing, key claims, and positioning
- **Your own LLM key** — response analysis calls go directly from your infrastructure to OpenAI or Anthropic. No third party in the middle.
- **ClickHouse analytics** — high-volume time-series storage built for prompt tracking at scale
- **Self-hosted, free forever** — full stack runs on any VPS with a single command

---

## Quick Start

**Requirements:** Node.js 20+, pnpm 10+, Docker

```bash
git clone https://github.com/aryamantodkar/oneglanse
cd oneglanse
pnpm install
pnpm local
```

Opens at [http://localhost:3000](http://localhost:3000). On first run the script handles everything: creates `.env`, starts Postgres / ClickHouse / Redis, runs migrations, and bootstraps the browser runtime. Go to `/providers` to connect your AI provider accounts.

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

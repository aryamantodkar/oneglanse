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

## License

MIT

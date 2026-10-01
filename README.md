<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/readme-brand-dark.svg" />
    <img src="docs/images/readme-brand-light.svg" alt="OneGlanse" width="232" height="64" />
  </picture>
</h1>

<p align="center"><strong>Free, open-source AI visibility tracking for marketing teams.</strong></p>

<p align="center">
  <a href="https://github.com/oneglanse/oneglanse/stargazers">
    <img src="https://img.shields.io/github/stars/oneglanse/oneglanse?style=flat-square" alt="GitHub stars" />
  </a>
  <a href="https://github.com/oneglanse/oneglanse/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/oneglanse/oneglanse?style=flat-square" alt="MIT License" />
  </a>
  <a href="https://www.producthunt.com/products/oneglanse">
    <img src="https://img.shields.io/badge/Product%20Hunt-%2328%20Day%20Rank-DA552F?style=flat-square&amp;logo=producthunt&amp;logoColor=white" alt="Product Hunt #28 Day Rank" />
  </a>
  <a href="https://docs.oneglanse.com">
    <img src="https://img.shields.io/badge/docs-oneglanse.com-blue?style=flat-square" alt="Documentation" />
  </a>
</p>

<p align="center">Track how your brand appears across ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview using real product interfaces, not model APIs.</p>

<p align="center">Run locally for free. Bring your own provider accounts and analysis model key.</p>

<p align="center">
  <img src="docs/images/hero-icon.png" alt="OneGlanse dashboard showing AI visibility, rank, sources, and prompt analytics" width="100%" />
</p>

## What it does

- Runs the prompts you choose in supported AI products and saves the visible responses.
- Tracks whether and where your brand appears, how it is described, and whether it is recommended.
- Shows competing brands that appear in the same answers.
- Records citations and source domains that appear in captured responses.
- Lets you inspect individual responses and follow changes across prompt runs.

The scores are produced by model-backed analysis of captured answers. They help compare runs, but they are interpretations of the response text, not measurements from the AI providers themselves. See the [analysis prompt](packages/services/src/analysis/analysisPrompt.ts) for the scoring instructions.

## Why UI responses differ from model API responses

An AI product includes more than its underlying model. Its interface can add search and retrieval, apply ranking and safety filters, personalize or shorten an answer, and present citations, source cards, recommendation order, and product-specific formatting. A model API exposes a different surface, so its answer can differ from what the product shows.

Surfer's [2026 study](https://surferseo.com/blog/llm-scraped-ai-answers-vs-api-results/) ran 1,000 prompts across five AI products and compared 13,779 answers collected from product interfaces and comparable APIs. It reported 21.3% to 31.6% overlap in named brands after normalizing brand names, and found that answer length and cited sources also varied by product. These figures describe that study's prompts and methods; results can differ for other prompts, accounts, or collection methods.

Collection uses your own provider accounts and authenticated browser sessions. Results can vary by account, location, prompt, and time. OneGlanse does not claim that a single run represents every user's experience. After collection, analysis sends the response to the model endpoint you configure with your own API key.

## Supported products

<table align="center">
  <tr>
    <td align="center"><img src="https://www.google.com/s2/favicons?domain=chatgpt.com&amp;sz=64" width="20" height="20" alt="" /><br />ChatGPT</td>
    <td align="center"><img src="https://www.google.com/s2/favicons?domain=perplexity.ai&amp;sz=64" width="20" height="20" alt="" /><br />Perplexity</td>
    <td align="center"><img src="https://www.google.com/s2/favicons?domain=gemini.google.com&amp;sz=64" width="20" height="20" alt="" /><br />Gemini</td>
    <td align="center"><img src="https://www.google.com/s2/favicons?domain=claude.ai&amp;sz=64" width="20" height="20" alt="" /><br />Claude</td>
    <td align="center"><img src="https://www.google.com/s2/favicons?domain=google.com&amp;sz=64" width="20" height="20" alt="" /><br />Google AI Overview</td>
  </tr>
</table>

<p align="center">Collection runs against their user-facing web interfaces.</p>

## How it works

1. Add your brand, competitors, and prompts.
2. The agent runs each prompt through the selected product's web UI, waits for the rendered answer to stabilize, then extracts the response and citations from the page DOM with provider-specific selectors.
3. OneGlanse stores the result, analyzes it with your configured model, and shows visibility, rank, sentiment, recommendations, sources, and changes over time.

See [ARCHITECTURE.md](https://github.com/oneglanse/oneglanse/blob/main/ARCHITECTURE.md) for the full data flow.

## Quick start

You need Node.js 20 or newer, pnpm 10 or newer, and Docker. You also need an analysis model API key, such as OpenAI or Anthropic, and accounts for the products you want to track.

OneGlanse has no subscription or usage fee. Model API usage, provider plans, VPS hosting, and proxy service can cost extra.

```bash
git clone https://github.com/oneglanse/oneglanse.git
cd oneglanse
cp .env.example .env
```

Set one analysis key in `.env`:

```dotenv
OPENAI_API_KEY=your-key
```

Or use Claude:

```dotenv
ANTHROPIC_API_KEY=your-key
ANALYSIS_LLM_PROVIDER=claude
```

Then start the local app:

```bash
pnpm local
```

Open [http://localhost:3000](http://localhost:3000), create an account, connect provider accounts at `/providers`, add prompts, and run them. The local script prepares the browser runtime, starts the supporting services, and applies database migrations. The first start can take longer while Docker images and browser files download.

Browser automation requires a usable desktop session for provider sign-in. Native macOS, Linux, or Windows is the documented setup path. WSL requires a working graphical display such as WSLg and is not part of the supported setup path. See the [local setup guide](https://docs.oneglanse.com/local-setup) for the full steps and troubleshooting.

## Local and self-hosted use

| | Local | Self-hosted |
| --- | --- | --- |
| Start | `pnpm local` on your computer | `pnpm self-host` on your server |
| App runtime | Web app and agent run from your checkout | Web app and agent run with Docker Compose |
| Prompt runs | Start runs manually | Schedule recurring runs |
| Provider sign-in | Use the local browser | Sign in locally, then upload sessions to your server |
| Browser traffic | Uses your local network | Configure a residential proxy for VPS runs |

Both modes use infrastructure you control for app data. Self-hosting is intended for an always-on deployment; it needs a server, a domain, provider accounts, an analysis key, and a proxy suitable for the provider sites. The [self-hosted guide](https://docs.oneglanse.com/self-hosted-setup) covers setup, session transfer, and operations. The landing site and documentation site are separate from the app runtime.

## Data and telemetry

Captured responses, analysis results, and provider sessions are stored in the local or self-hosted app stack. Response analysis sends captured text to the OpenAI, Anthropic, or compatible model endpoint you configure. Provider sign-in and self-hosted session transfer use your own accounts and server. Review your model provider's data handling terms before you send responses to it.

The app also sends `user_signed_up` and `user_active` events to PostHog. Each event contains a SHA-256 hash of the app's internal user ID; PostHog adds a receipt timestamp. The telemetry request does not include prompts, captured responses, scores, names, or email addresses. See [the telemetry implementation](apps/web/src/lib/telemetry.ts) for the exact request.

## Documentation and contributing

The [documentation](https://docs.oneglanse.com) has detailed [local setup](https://docs.oneglanse.com/local-setup) and [self-hosted setup](https://docs.oneglanse.com/self-hosted-setup) guides. [ARCHITECTURE.md](ARCHITECTURE.md) explains the repository and runtime boundaries. To report a bug or propose a change, read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

OneGlanse is available under the [MIT License](LICENSE).

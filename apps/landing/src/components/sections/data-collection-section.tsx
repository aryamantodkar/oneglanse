import { Card } from "@oneglanse/ui";
import { Bot, ExternalLink, Eye, Fingerprint, ShieldCheck, Wifi } from "lucide-react";

const METHOD_POINTS = [
  "OneGlanse captures model web UI outputs through logged-out sessions for real user-view results.",
  "Scraping runs through residential proxies to reduce geo bias and improve coverage stability.",
  "Claude is excluded from UI scraping and is integrated through the official Claude API only.",
  "UI answers and API answers can differ in ranking, wording, and citation behavior for the same prompt.",
  "Most GEO vendors do not disclose collection methods, refresh cadence, or model provenance details.",
] as const;

export function DataCollectionSection(): React.JSX.Element {
  return (
    <section className="section-shell py-12 sm:py-14" id="data-methodology" aria-labelledby="data-methodology-title">
      <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black">
        <h2 id="data-methodology-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Data collection methodology
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          We disclose exactly how AI visibility data is collected and why UI-first monitoring matters.
        </p>

        <ul className="mt-5 grid gap-2.5">
          {METHOD_POINTS.map((point, index) => (
            <li
              key={point}
              className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 dark:border-gray-800 dark:text-gray-100"
            >
              <span className="inline-flex items-start gap-2.5">
                {index === 0 ? <Eye className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                {index === 1 ? <Wifi className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                {index === 2 ? <Bot className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                {index === 3 ? <Fingerprint className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                {index === 4 ? <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                <span className="leading-6">{point}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Independent reference
          </p>
          <a
            href="https://surferseo.com/blog/llm-scraped-ai-answers-vs-api-results/"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground dark:border-gray-800"
          >
            LLM scraped AI answers vs API results
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </Card>
    </section>
  );
}

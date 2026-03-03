import { Card } from "@oneglanse/ui";
import { AlertCircle, BadgeCheck, Clock3, Database, ShieldCheck } from "lucide-react";

const VARIANCE_POINTS = [
  "LLM web interfaces can diverge from API responses for the same prompt.",
  "Ranking, tone, and citations shift by provider, region, and release cycle.",
  "Reliable GEO decisions require measured output variance, not one-off snapshots.",
] as const;

const TRANSPARENCY_GAPS = [
  "Collection method (scraping vs official API)",
  "Published rate limits and retry behavior",
  "Data freshness windows and recrawl cadence",
  "Model provenance and version mapping",
] as const;

export function DataCollectionSection(): React.JSX.Element {
  return (
    <section className="section-shell py-12 sm:py-14" id="output-variance" aria-labelledby="output-variance-title">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black">
          <h2 id="output-variance-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Model output variance is real.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            We measure what users actually see, then expose variance as a first-class signal.
          </p>
          <ul className="mt-5 grid gap-2">
            {VARIANCE_POINTS.map((point) => (
              <li
                key={point}
                className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 dark:border-gray-800 dark:text-gray-100"
              >
                <span className="inline-flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>{point}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Transparency and provider disclosures
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Many GEO tools do not disclose core collection and provenance controls. OneGlanse does.
          </p>
          <ul className="mt-5 grid gap-2">
            {TRANSPARENCY_GAPS.map((point) => (
              <li
                key={point}
                className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 dark:border-gray-800 dark:text-gray-100"
              >
                <span className="inline-flex items-start gap-2">
                  <Database className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>{point}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl border border-gray-200 p-3.5 dark:border-gray-800">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Claude API disclosure
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Claude results in OneGlanse are powered by the official Claude API. No scraping. No reverse engineering. Direct provider integration.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 dark:border-gray-800">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                API-based
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 dark:border-gray-800">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Rate-limit aware
              </span>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

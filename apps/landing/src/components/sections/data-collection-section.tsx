import { Card } from "@oneglanse/ui";
import { AlertCircle, Globe, Monitor } from "lucide-react";

const POINTS = [
  "LLM API outputs are often inconsistent with what end users see in chat web interfaces.",
  "UI responses can diverge in ranking, tone, and cited sources even for the same prompt.",
  "OneGlanse collects data from real model web UIs to measure actual answer visibility.",
  "Exception: Claude requires an authenticated session and cannot be scraped logged out.",
] as const;

export function DataCollectionSection(): React.JSX.Element {
  return (
    <section className="section-shell py-10 sm:py-12" aria-labelledby="data-collection-title">
      <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="data-collection-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Built for real-world LLM output variance
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              API-only monitoring misses how buyers actually encounter answers. This platform tracks UI-level responses for reliable AI visibility analysis.
            </p>
          </div>
          <ul className="space-y-2">
            {POINTS.map((point, index) => (
              <li
                key={point}
                className="ui-list-item rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 dark:border-gray-800 dark:bg-black dark:text-gray-100"
              >
                <span className="inline-flex items-start gap-2">
                  {index === 0 ? <Monitor className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                  {index === 1 ? <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                  {index >= 2 ? <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                  <span>{point}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}

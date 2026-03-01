import { Card } from "@oneglanse/ui";
import { SITE_URLS } from "@/lib/landing-content";

const OPEN_SOURCE_POINTS = [
  "100% open source codebase",
  "Docker-based deployment for web, agent, and data stores",
  "Full control over prompts, responses, and analytics data",
  "No vendor lock-in across provider integrations",
  "Infrastructure and pipeline transparency",
] as const;

export function OpenSourceSection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="open-source" aria-labelledby="open-source-title">
      <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="open-source-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Open source and fully self-hostable by design
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              OneGlanse is built for technical teams that require ownership of infrastructure, observability, and data governance.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={SITE_URLS.github}
                className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium dark:border-gray-800"
                target="_blank"
                rel="noreferrer noopener"
              >
                View on GitHub
              </a>
              <a
                href={SITE_URLS.docs}
                className="inline-flex items-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                target="_blank"
                rel="noreferrer noopener"
              >
                Self-host Instructions
              </a>
            </div>
          </div>
          <ul className="grid gap-2">
            {OPEN_SOURCE_POINTS.map((point) => (
              <li key={point} className="ui-list-item rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
                {point}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}

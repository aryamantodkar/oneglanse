import { Card } from "@oneglanse/ui";
import { SITE_URLS } from "@/lib/landing-content";
import { Boxes, Github, Server, ShieldCheck } from "lucide-react";

const OPEN_SOURCE_POINTS = [
  "Open source repository and audit trail",
  "Dockerized web, worker, queue, and analytics stack",
  "Data ownership for prompts, responses, and sources",
  "No provider lock-in",
  "Reproducible pipeline from run to metric",
] as const;

export function OpenSourceSection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="open-source"
      aria-labelledby="open-source-title"
    >
      <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black">
        <div className="grid items-start gap-7 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="open-source-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Open by design. Deploy on your terms.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Self-host the full stack and keep full control over data, runtime, and observability.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={SITE_URLS.github}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium dark:border-gray-800"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                View on GitHub
              </a>
              <a
                href={SITE_URLS.docs}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Server className="h-4 w-4" aria-hidden="true" />
                Self-host Instructions
              </a>
            </div>
          </div>
          <ul className="grid gap-2.5">
            {OPEN_SOURCE_POINTS.map((point, index) => (
              <li
                key={point}
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 dark:border-gray-800 dark:bg-black dark:text-gray-100"
              >
                <span className="inline-flex items-start gap-2.5">
                  {index === 0 ? <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                  {index > 0 ? <Boxes className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
                  <span className="leading-6">{point}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}

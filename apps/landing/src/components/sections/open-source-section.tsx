import { Card } from "@oneglanse/ui";
import { SITE_URLS } from "@/lib/landing-content";
import { Github, Lock, Server } from "lucide-react";

const OPEN_SOURCE_POINTS = [
  "100% open source codebase",
  "Docker deployment for web, worker, queues, and analytics",
  "Own your prompts, responses, and source intelligence data",
  "No vendor lock-in across model providers",
  "Transparent pipeline from prompt run to visibility metrics",
] as const;

export function OpenSourceSection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="open-source"
      aria-labelledby="open-source-title"
    >
      <Card className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-black">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="open-source-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Built for teams that need control, not black boxes
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Self-host the full stack, inspect every signal, and operate AI visibility with infrastructure-grade transparency.
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
          <ul className="grid gap-2">
            {OPEN_SOURCE_POINTS.map((point) => (
              <li
                key={point}
                className="ui-list-item rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 dark:border-gray-800 dark:bg-black dark:text-gray-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}

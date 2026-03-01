import { ArrowRight, BookOpen, Github } from "lucide-react";

const APP_URL = "https://app.oneglanse.com";
const DOCS_URL = "https://oneglanse.com/docs";
const GITHUB_URL = "https://github.com";

export function HeroSection(): React.JSX.Element {
  return (
    <section className="section-shell pt-16 pb-14 sm:pt-24 sm:pb-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-5 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
          Open Source &amp; Self Hostable
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Track and improve your brand visibility across AI answers.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">
          OneGlanse runs repeatable prompt tests across major providers, stores results in ClickHouse,
          and surfaces GEO insights your team can act on.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={APP_URL}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
          >
            Open App
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href={DOCS_URL}
            className="inline-flex items-center gap-2 rounded-lg border bg-transparent px-4 py-2 text-sm font-medium"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            View Docs
          </a>
          <a
            href={GITHUB_URL}
            className="inline-flex items-center gap-2 rounded-lg border bg-transparent px-4 py-2 text-sm font-medium"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

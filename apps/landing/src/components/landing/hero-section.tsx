import { ArrowRight, BookOpen, Github } from "lucide-react";

const APP_URL = "https://app.oneglanse.com";
const DOCS_URL = "https://oneglanse.com/docs";
const GITHUB_URL = "https://github.com/aryamantodkar/oneglanse";

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
            target="_blank"
            rel="noreferrer noopener"
          >
            Open App
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href={DOCS_URL}
            className="inline-flex items-center gap-2 rounded-lg border bg-transparent px-4 py-2 text-sm font-medium"
            target="_blank"
            rel="noreferrer noopener"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            View Docs
          </a>
          <a
            href={GITHUB_URL}
            className="inline-flex items-center gap-2 rounded-lg border bg-transparent px-4 py-2 text-sm font-medium"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            GitHub
          </a>
        </div>
        <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          <article className="surface-card">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">AI Presence</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">Across 5 Providers</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Single run, normalized comparison.</p>
          </article>
          <article className="surface-card">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Response Intelligence</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">Source + Sentiment</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Measure mention quality, not only count.</p>
          </article>
          <article className="surface-card">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Deployment</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">Self-host Ready</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Docker-first architecture for full control.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

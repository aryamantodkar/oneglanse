const GITHUB_URL = "https://github.com";
const DOCS_URL = "https://oneglanse.com/docs";

export function OpenSourceSection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="open-source" aria-labelledby="open-source-title">
      <div className="surface-card flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="open-source-title" className="text-2xl font-semibold tracking-tight">
            Open source from worker to dashboard
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
            Review every architectural decision, self-host with Docker, and run OneGlanse in your own environment.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={GITHUB_URL}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium"
          >
            View on GitHub
          </a>
          <a
            href={DOCS_URL}
            className="inline-flex items-center rounded-lg border border-transparent bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
          >
            Self-host Instructions
          </a>
        </div>
      </div>
    </section>
  );
}

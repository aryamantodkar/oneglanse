import { DashboardBrowserPreview } from "@/components/previews/dashboard-browser-preview";
import { SITE_URLS } from "@/lib/landing-content";
import { ArrowRight, Github } from "lucide-react";

export function HeroSection(): React.JSX.Element {
  return (
    <section className="section-shell pb-16 pt-12 sm:pb-20 sm:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 xl:grid-cols-[1.05fr_1fr]">
        <div className="ui-stagger">
          <p className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:border-gray-800 dark:bg-gray-950">
            AI Visibility Infrastructure
          </p>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Monitor and improve how AI models represent your brand.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Run repeatable prompt evaluations across providers, track ranking and sentiment, and inspect citation-level source intelligence in one system.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={SITE_URLS.docs}
              className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              target="_blank"
              rel="noreferrer noopener"
            >
              Self Host Now
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href={SITE_URLS.github}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium dark:border-gray-800 dark:bg-gray-950"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              View on GitHub
            </a>
          </div>
        </div>
        <div className="ui-page-enter">
          <DashboardBrowserPreview />
        </div>
      </div>
    </section>
  );
}

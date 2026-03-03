import { DashboardBrowserPreview } from "@/components/previews/dashboard-browser-preview";
import { SITE_URLS } from "@/lib/landing-content";
import { ArrowRight, Github, Rocket, Server } from "lucide-react";

export function HeroSection(): React.JSX.Element {
  return (
    <section className="section-shell pb-14 pt-10 sm:pb-18 sm:pt-14">
      <div className="mx-auto grid max-w-6xl items-center gap-8 xl:grid-cols-[1.05fr_1fr] xl:gap-12">
        <div className="ui-stagger">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Win the answers your buyers read in AI.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Track visibility, sentiment, and citations across real model outputs.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={SITE_URLS.app}
              className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              Try Now
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href={SITE_URLS.github}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium dark:border-gray-800 dark:bg-black"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              View on GitHub
            </a>
            <a
              href={SITE_URLS.docs}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium dark:border-gray-800 dark:bg-black"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Server className="h-4 w-4" aria-hidden="true" />
              Self Host
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

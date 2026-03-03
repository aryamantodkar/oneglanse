import { ThemeToggle } from "@/components/landing/theme-toggle";
import { SITE_URLS } from "@/lib/landing-content";
import { ArrowRight, Github, Rocket, Server } from "lucide-react";

export function SiteHeader(): React.JSX.Element {
  return (
    <header className="section-shell sticky top-0 z-40 pt-4 sm:pt-5">
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-black">
        <a
          href={SITE_URLS.homepage}
          className="inline-flex items-center text-base font-semibold tracking-tight sm:text-lg"
          target="_blank"
          rel="noreferrer noopener"
        >
          OneGlanse
        </a>

        <div className="flex items-center gap-2">
          <a
            href={SITE_URLS.app}
            className="hidden items-center gap-2 rounded-lg border border-transparent bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground sm:inline-flex"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            Try Now
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href={SITE_URLS.github}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium dark:border-gray-800"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href={SITE_URLS.docs}
            className="hidden items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium md:inline-flex dark:border-gray-800"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Server className="h-4 w-4" aria-hidden="true" />
            Self Host
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

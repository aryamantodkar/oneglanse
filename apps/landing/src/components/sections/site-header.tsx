import { ThemeToggle } from "@/components/landing/theme-toggle";
import { SITE_URLS } from "@/lib/landing-content";

export function SiteHeader(): React.JSX.Element {
  return (
    <header className="section-shell pt-5 sm:pt-6">
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white/85 px-4 py-3 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/70">
        <a href={SITE_URLS.homepage} className="inline-flex items-center gap-2" target="_blank" rel="noreferrer noopener">
          <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">OG</span>
          <span className="text-base font-semibold tracking-tight sm:text-lg">OneGlanse</span>
        </a>
        <div className="flex items-center gap-2">
          <a
            href={SITE_URLS.github}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

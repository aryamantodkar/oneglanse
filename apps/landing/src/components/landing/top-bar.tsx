import { ThemeToggle } from "@/components/landing/theme-toggle";

const GITHUB_URL = "https://github.com/aryamantodkar/oneglanse";

export function TopBar(): React.JSX.Element {
  return (
    <header className="section-shell pt-5 sm:pt-6">
      <div className="flex items-center justify-between rounded-xl border px-4 py-3">
        <a
          href="https://oneglanse.com"
          className="inline-flex items-center gap-2"
          target="_blank"
          rel="noreferrer noopener"
        >
          <span className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-semibold text-[var(--accent-foreground)]">
            OG
          </span>
          <span className="text-base font-semibold tracking-tight sm:text-lg">OneGlanse</span>
        </a>
        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            className="rounded-lg border px-3 py-2 text-sm font-medium"
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

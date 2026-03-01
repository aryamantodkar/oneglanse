import { SITE_URLS } from "@/lib/landing-content";

const FOOTER_LINKS = [
  { label: "Docs", href: SITE_URLS.docs },
  { label: "GitHub", href: SITE_URLS.github },
  { label: "App", href: SITE_URLS.app },
  { label: "License", href: SITE_URLS.githubLicense },
] as const;

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-gray-200 py-8 dark:border-gray-800">
      <div className="section-shell flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} OneGlanse</p>
        <nav aria-label="Footer links">
          <ul className="flex flex-wrap items-center gap-4">
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="hover:text-foreground" target="_blank" rel="noreferrer noopener">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

const FOOTER_LINKS = [
  { label: "Docs", href: "https://oneglanse.com/docs" },
  { label: "GitHub", href: "https://github.com" },
  { label: "App", href: "https://app.oneglanse.com" },
  { label: "License", href: "https://github.com" },
] as const;

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t py-8">
      <div className="section-shell flex flex-col gap-4 text-sm text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} OneGlanse</p>
        <nav aria-label="Footer links">
          <ul className="flex flex-wrap items-center gap-4">
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="hover:underline">
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

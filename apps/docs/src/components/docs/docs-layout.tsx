import { DOC_SECTIONS } from "@/lib/docs-index";
import { SidebarNav } from "@/components/docs/sidebar-nav";

type DocsLayoutProps = {
  activeSlug: string;
  children: React.ReactNode;
};

function getSectionTitle(slug: string): string {
  return DOC_SECTIONS.find((section) => section.slug === slug)?.title ?? "Documentation";
}

function getSectionDescription(slug: string): string {
  return DOC_SECTIONS.find((section) => section.slug === slug)?.description ?? "";
}

export function DocsLayout({ activeSlug, children }: DocsLayoutProps): React.JSX.Element {
  return (
    <div className="docs-shell">
      <SidebarNav activeSlug={activeSlug} />
      <main className="docs-main">
        <header className="mb-6 docs-card p-5">
          <h1 className="text-2xl font-semibold tracking-tight">{getSectionTitle(activeSlug)}</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{getSectionDescription(activeSlug)}</p>
        </header>
        <div className="docs-card p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

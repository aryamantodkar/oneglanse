import Link from "next/link";
import { DOC_SECTIONS, type DocSection } from "@/lib/docs-index";

type SidebarNavProps = {
  activeSlug: string;
};

function getLinkClass(isActive: boolean): string {
  return [
    "block rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-[var(--card)] font-medium"
      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
  ].join(" ");
}

function renderNavItem(section: DocSection, activeSlug: string): React.JSX.Element {
  const isActive = section.slug === activeSlug;

  return (
    <li key={section.slug}>
      <Link href={`/${section.slug}`} className={getLinkClass(isActive)} aria-current={isActive ? "page" : undefined}>
        {section.title}
      </Link>
    </li>
  );
}

export function SidebarNav({ activeSlug }: SidebarNavProps): React.JSX.Element {
  return (
    <aside className="docs-sidebar border-r p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <div className="mb-6 space-y-2">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          OneGlanse Docs
        </Link>
        <p className="text-sm text-[var(--muted-foreground)]">Self-hosting and operations guide</p>
      </div>
      <nav aria-label="Documentation sections">
        <ul className="space-y-1">{DOC_SECTIONS.map((section) => renderNavItem(section, activeSlug))}</ul>
      </nav>
    </aside>
  );
}

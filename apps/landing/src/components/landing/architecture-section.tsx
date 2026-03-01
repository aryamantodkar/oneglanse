import { SectionHeading } from "@/components/common/section-heading";
import { ARCHITECTURE_NODES } from "@/lib/landing-content";

export function ArchitectureSection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="architecture" aria-labelledby="architecture-title">
      <SectionHeading
        eyebrow="Architecture"
        title="Designed as an operational pipeline"
        description="The web app, agent workers, queue system, and analytics store run as isolated services so each tier scales independently."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ARCHITECTURE_NODES.map((node) => (
          <article key={node.title} className="surface-card">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{node.title}</h3>
            <p className="mt-3 text-sm leading-6">{node.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

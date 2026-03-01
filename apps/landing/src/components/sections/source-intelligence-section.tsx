import { SectionHeading } from "@/components/common/section-heading";
import { SourceIntelligencePreview } from "@/components/previews/source-intelligence-preview";

export function SourceIntelligenceSection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="source-intelligence"
      aria-labelledby="source-intelligence-title"
    >
      <SectionHeading
        eyebrow="Sources & Citations"
        title="Inspect the domains shaping AI answers"
        description="Audit source concentration, provider overlap, and citation excerpts in a dense, dashboard-style preview."
      />
      <SourceIntelligencePreview />
    </section>
  );
}

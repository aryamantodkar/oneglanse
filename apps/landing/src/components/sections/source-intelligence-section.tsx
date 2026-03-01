import { SectionHeading } from "@/components/common/section-heading";
import { SourceIntelligencePreview } from "@/components/previews/source-intelligence-preview";

export function SourceIntelligenceSection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="source-intelligence" aria-labelledby="source-intelligence-title">
      <SectionHeading
        eyebrow="Source Intelligence"
        title="See where model responses are grounded"
        description="Inspect dominant source domains, provider overlap, and citation concentration through a compact sources dashboard preview."
      />
      <SourceIntelligencePreview />
    </section>
  );
}

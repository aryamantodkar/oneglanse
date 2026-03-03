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
        title="Know which sources shape AI decisions."
        description="Find the publishers driving your brand visibility."
      />
      <SourceIntelligencePreview />
    </section>
  );
}

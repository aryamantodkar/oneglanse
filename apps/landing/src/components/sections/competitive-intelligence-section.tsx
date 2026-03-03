import { SectionHeading } from "@/components/common/section-heading";
import { CompetitiveIntelligencePreview } from "@/components/previews/competitive-intelligence-preview";

export function CompetitiveIntelligenceSection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="competitive-intelligence"
      aria-labelledby="competitive-intelligence-title"
    >
      <SectionHeading
        eyebrow="Competitor Benchmark"
        title="Benchmark the market in one table."
      />
      <CompetitiveIntelligencePreview />
    </section>
  );
}

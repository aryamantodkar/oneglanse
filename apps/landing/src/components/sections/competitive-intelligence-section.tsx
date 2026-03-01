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
        eyebrow="Competitive Context"
        title="Benchmark visibility against category leaders"
        description="Understand mention share, sentiment position, and competitive pressure across the same prompt runs."
      />
      <CompetitiveIntelligencePreview />
    </section>
  );
}

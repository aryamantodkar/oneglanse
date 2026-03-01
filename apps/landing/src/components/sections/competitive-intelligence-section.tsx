import { SectionHeading } from "@/components/common/section-heading";
import { CompetitiveIntelligencePreview } from "@/components/previews/competitive-intelligence-preview";

export function CompetitiveIntelligenceSection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="competitive-intelligence" aria-labelledby="competitive-intelligence-title">
      <SectionHeading
        eyebrow="Competitive Intelligence"
        title="Track your competitive position across answer ecosystems"
        description="Compare visibility and sentiment against direct peers and inspect relative strength using dashboard-consistent components."
      />
      <CompetitiveIntelligencePreview />
    </section>
  );
}

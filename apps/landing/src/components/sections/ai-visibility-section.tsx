import { SectionHeading } from "@/components/common/section-heading";
import { AiVisibilityPreview } from "@/components/previews/ai-visibility-preview";

export function AiVisibilitySection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="competitor-comparison"
      aria-labelledby="competitor-comparison-title"
    >
      <SectionHeading
        eyebrow="Competitor Comparison"
        title="How HubSpot performs against direct alternatives in AI answers"
        description="A complete horizontal comparison across presence, recommendation, sentiment, and rank strength."
      />
      <AiVisibilityPreview />
    </section>
  );
}

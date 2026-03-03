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
        eyebrow="Visibility Scoreboard"
        title="See who wins the answer."
        description="Presence, recommendation, sentiment, and rank in one benchmark."
      />
      <AiVisibilityPreview />
    </section>
  );
}

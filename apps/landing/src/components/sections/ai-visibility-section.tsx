import { SectionHeading } from "@/components/common/section-heading";
import { AiVisibilityPreview } from "@/components/previews/ai-visibility-preview";

export function AiVisibilitySection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="ai-visibility"
      aria-labelledby="ai-visibility-title"
    >
      <SectionHeading
        eyebrow="AI Perception"
        title="See how models position your brand before your buyers do"
        description="Perception, ranking, and recommendation signals rendered from the same product components used in the dashboard."
      />
      <AiVisibilityPreview />
    </section>
  );
}

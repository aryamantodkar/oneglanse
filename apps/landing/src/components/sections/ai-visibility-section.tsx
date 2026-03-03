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
        eyebrow="Capabilities"
        title="See who wins the answer."
        description="One view for presence, recommendation, sentiment, and rank strength."
      />
      <AiVisibilityPreview />
    </section>
  );
}

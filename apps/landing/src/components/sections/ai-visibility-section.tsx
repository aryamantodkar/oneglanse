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
        title="See how your brand performs across AI answers"
        description="Track where you lead, where you lag, and what to improve next across all LLM providers."
      />
      <AiVisibilityPreview />
    </section>
  );
}

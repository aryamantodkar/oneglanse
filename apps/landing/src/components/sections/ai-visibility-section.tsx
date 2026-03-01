import { SectionHeading } from "@/components/common/section-heading";
import { AiVisibilityPreview } from "@/components/previews/ai-visibility-preview";

export function AiVisibilitySection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="ai-visibility" aria-labelledby="ai-visibility-title">
      <SectionHeading
        eyebrow="AI Visibility Tracking"
        title="Measure ranking, recommendation, and sentiment in one view"
        description="The preview below uses static data but the exact same chart and AI perception cards used in the dashboard experience."
      />
      <AiVisibilityPreview />
    </section>
  );
}

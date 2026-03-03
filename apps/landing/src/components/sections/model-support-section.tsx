import { SectionHeading } from "@/components/common/section-heading";
import { ModelSupportPreview } from "@/components/previews/model-support-preview";

export function ModelSupportSection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="model-support"
      aria-labelledby="model-support-title"
    >
      <SectionHeading
        eyebrow="Provider Matrix"
        title="Compare providers on equal footing."
        description="Same prompts. Same scoring logic. Provider-specific outcomes."
      />
      <ModelSupportPreview />
    </section>
  );
}

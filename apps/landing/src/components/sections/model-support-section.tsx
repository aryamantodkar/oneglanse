import { SectionHeading } from "@/components/common/section-heading";
import { ModelSupportPreview } from "@/components/previews/model-support-preview";

export function ModelSupportSection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="model-support" aria-labelledby="model-support-title">
      <SectionHeading
        eyebrow="Model & Provider Support"
        title="Supports multiple AI providers and model families"
        description="Use provider-aware filtering with consistent icons and labels for OpenAI, Claude, Gemini, Perplexity, and AI Overview."
      />
      <ModelSupportPreview />
    </section>
  );
}

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
        eyebrow="Multi-Provider Support"
        title="Run the same analysis across all major model providers"
        description="OpenAI, Claude, Gemini, Perplexity, and AI Overview with one consistent filter and reporting surface."
      />
      <ModelSupportPreview />
    </section>
  );
}

import { BrandPerceptionCard } from "@oneglanse/ui";
import { PREVIEW_PERCEPTION } from "@/lib/preview-data";

export function AiPerceptionSection(): React.JSX.Element {
  return (
    <section className="section-shell py-12 sm:py-14" id="ai-perception" aria-labelledby="ai-perception-title">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-10">
        <div>
          <h2 id="ai-perception-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI Perception
          </h2>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
            See exactly how leading LLMs frame your brand, pricing position, and core differentiation in real answers.
          </p>
        </div>

        <div className="min-w-0">
          <BrandPerceptionCard
            bestKnownFor={PREVIEW_PERCEPTION.bestKnownFor}
            pricingPerception={PREVIEW_PERCEPTION.pricingPerception}
            coreClaims={[...PREVIEW_PERCEPTION.coreClaims]}
            differentiators={[...PREVIEW_PERCEPTION.differentiators]}
          />
        </div>
      </div>
    </section>
  );
}

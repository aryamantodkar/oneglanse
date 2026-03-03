import { BrandPerceptionCard } from "@oneglanse/ui";
import { CheckCircle2, MessageSquareQuote, Tags } from "lucide-react";
import { PREVIEW_PERCEPTION } from "@/lib/preview-data";

const PRICING_LABELS: Record<string, string> = {
  premium: "Premium",
  mid_range: "Mid-range",
  budget: "Budget",
  free: "Free",
  not_mentioned: "Not mentioned",
};

export function AiPerceptionSection(): React.JSX.Element {
  return (
    <section className="section-shell py-12 sm:py-14" id="ai-perception" aria-labelledby="ai-perception-title">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <div className="space-y-5">
          <h2 id="ai-perception-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI Perception
          </h2>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
            See exactly how leading LLMs frame your brand, pricing position, and core differentiation in real answers.
          </p>

          <ul className="space-y-2.5">
            <li className="inline-flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Narrative themes pulled from real provider outputs
            </li>
            <li className="inline-flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Pricing and positioning signals distilled into decision-ready insights
            </li>
            <li className="inline-flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Differentiators surfaced with consistent phrasing across providers
            </li>
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-black">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <MessageSquareQuote className="h-3.5 w-3.5" />
                Best Known For
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                {PREVIEW_PERCEPTION.bestKnownFor.charAt(0).toUpperCase() + PREVIEW_PERCEPTION.bestKnownFor.slice(1)}
              </p>
            </article>

            <article className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-black">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Tags className="h-3.5 w-3.5" />
                Pricing Signal
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                {PRICING_LABELS[PREVIEW_PERCEPTION.pricingPerception] ?? PREVIEW_PERCEPTION.pricingPerception}
              </p>
            </article>
          </div>
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

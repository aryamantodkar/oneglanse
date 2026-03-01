"use client";

import { BrandPerceptionCard, CompetitiveLandscape } from "@oneglanse/ui";
import {
  PREVIEW_ALT_PERCEPTION,
  PREVIEW_COMPETITORS,
} from "@/lib/preview-data";

export function CompetitiveIntelligencePreview(): React.JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <CompetitiveLandscape competitors={PREVIEW_COMPETITORS} />
      <div className="min-w-0">
        <BrandPerceptionCard
          bestKnownFor={PREVIEW_ALT_PERCEPTION.bestKnownFor}
          pricingPerception={PREVIEW_ALT_PERCEPTION.pricingPerception}
          coreClaims={[...PREVIEW_ALT_PERCEPTION.coreClaims]}
          differentiators={[...PREVIEW_ALT_PERCEPTION.differentiators]}
        />
      </div>
    </div>
  );
}

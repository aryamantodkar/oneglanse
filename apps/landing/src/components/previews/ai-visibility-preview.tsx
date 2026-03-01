"use client";

import { useEffect, useState } from "react";
import { BrandComparisonChart, BrandPerceptionCard } from "@oneglanse/ui";
import {
  PREVIEW_BRAND,
  PREVIEW_COMPETITORS,
  PREVIEW_PERCEPTION,
  PREVIEW_TOTAL_RESPONSES,
} from "@/lib/preview-data";

export function AiVisibilityPreview(): React.JSX.Element {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div
        className={`transition-all duration-500 ${
          loaded ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-80"
        }`}
      >
        <BrandComparisonChart
          competitors={PREVIEW_COMPETITORS}
          brandName={PREVIEW_BRAND.name}
          brandDomain={PREVIEW_BRAND.domain}
          totalResponses={PREVIEW_TOTAL_RESPONSES}
          brandPresenceRate={86}
          brandRecommendationRate={68}
          brandSentimentScore={82}
          brandAvgRank={1.4}
        />
      </div>
      <div className="transition-all delay-100 duration-500">
        <BrandPerceptionCard
          bestKnownFor={PREVIEW_PERCEPTION.bestKnownFor}
          pricingPerception={PREVIEW_PERCEPTION.pricingPerception}
          coreClaims={[...PREVIEW_PERCEPTION.coreClaims]}
          differentiators={[...PREVIEW_PERCEPTION.differentiators]}
        />
      </div>
    </div>
  );
}

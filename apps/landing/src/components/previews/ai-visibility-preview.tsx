"use client";

import { BrandComparisonChart, BrandPerceptionCard, Card } from "@oneglanse/ui";
import {
  PREVIEW_BRAND,
  PREVIEW_COMPETITORS,
  PREVIEW_PERCEPTION,
  PREVIEW_TOTAL_RESPONSES,
} from "@/lib/preview-data";

export function AiVisibilityPreview(): React.JSX.Element {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <div className="min-w-0">
        <BrandPerceptionCard
          bestKnownFor={PREVIEW_PERCEPTION.bestKnownFor}
          pricingPerception={PREVIEW_PERCEPTION.pricingPerception}
          coreClaims={[...PREVIEW_PERCEPTION.coreClaims]}
          differentiators={[...PREVIEW_PERCEPTION.differentiators]}
        />
      </div>

      <div className="grid gap-4">
        <Card className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Ranking Position
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Avg Rank #1.6
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            84% presence rate across 264 analyzed model responses.
          </p>
        </Card>

        <div className="min-w-0 overflow-hidden rounded-2xl">
          <BrandComparisonChart
            competitors={PREVIEW_COMPETITORS}
            brandName={PREVIEW_BRAND.name}
            brandDomain={PREVIEW_BRAND.domain}
            totalResponses={PREVIEW_TOTAL_RESPONSES}
            brandPresenceRate={84}
            brandRecommendationRate={66}
            brandSentimentScore={81}
            brandAvgRank={1.6}
          />
        </div>
      </div>
    </div>
  );
}

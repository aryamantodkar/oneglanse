import { BrandComparisonChart } from "@oneglanse/ui";
import {
  PREVIEW_BRAND,
  PREVIEW_COMPETITORS,
  PREVIEW_TOTAL_RESPONSES,
} from "@/lib/preview-data";

export function AiVisibilityPreview(): React.JSX.Element {
  return (
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
  );
}

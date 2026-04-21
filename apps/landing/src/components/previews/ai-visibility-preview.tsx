import {
	PREVIEW_BRAND,
	PREVIEW_BRAND_METRICS,
	PREVIEW_COMPETITORS,
	PREVIEW_TOTAL_RESPONSES,
} from "@/lib/preview-data";
import { BrandComparisonChart } from "@oneglanse/ui";

export function AiVisibilityPreview(): React.JSX.Element {
	return (
		<div className="min-w-0 overflow-hidden rounded-2xl">
			<BrandComparisonChart
				competitors={PREVIEW_COMPETITORS}
				brandName={PREVIEW_BRAND.name}
				totalResponses={PREVIEW_TOTAL_RESPONSES}
				brandPresenceRate={PREVIEW_BRAND_METRICS.presenceRate}
				brandRecommendationRate={PREVIEW_BRAND_METRICS.recommendationRate}
				brandSentimentScore={PREVIEW_BRAND_METRICS.sentimentScore}
				brandAvgRank={PREVIEW_BRAND_METRICS.avgRank}
			/>
		</div>
	);
}

import type { AnalysisRecord } from "@oneglanse/types";
import type { DashboardCompetitorData as CompetitorData, DashboardSourceData as SourceData } from "@oneglanse/ui";

export type { CompetitorData, SourceData };

export interface DashboardMetrics {
	brandName: string;
	brandDomain: string;
	avgRank: { position: number | null; total: number | null };
	avgSentiment: { score: number; label: string };
	impactMetrics: {
		totalResponses: number;
		avgGeoScore: number;
		avgVisibility: number;
		recommendationRate: number;
		topPickRate: number;
		earlyMentionRate: number;
		dominantPresenceRate: number;
		absentRate: number;
		riskResponseRate: number;
		criticalRiskCount: number;
		warningRiskCount: number;
	};
	aggregateStats: {
		presenceRate: number;
		winRate: number;
		recRate: number;
		topCompetitor: string;
	};
	competitorData: CompetitorData[];
	brandPerception: {
		bestKnownFor: string | null;
		pricingPerception: string;
		coreClaims: string[];
		differentiators: string[];
	};
	sourcesIntelligence: SourceData[];
	totalCitations: number;
	analyzedRecords: AnalysisRecord[];
}

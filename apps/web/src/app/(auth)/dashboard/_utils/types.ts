import type { AnalysisRecord } from "@onescope/types";

export interface CompetitorData {
	name: string;
	domain: string;
	appearances: number;
	avgSentiment: number;
	avgRank: number | null;
	recCount: number;
	winsOver: string[];
	losesTo: string[];
	isBrand?: boolean;
}

export interface SourceData {
	domain: string;
	favicon: string | null;
	citationCount: number;
	uniqueRecords: Set<string>;
	models: Set<string>;
}

export interface RiskData {
	type: string;
	severity: string;
	detail: string;
	count: number;
}

export interface GroupedRecord {
	prompt: string;
	records: AnalysisRecord[];
	avgScore: number;
	avgSentiment: number;
	bestRank: number | null;
	topRecType: string;
}

export interface DashboardMetrics {
	brandName: string;
	avgRank: { position: number | null; total: number | null };
	avgSentiment: { score: number; label: string };
	aggregateStats: {
		presenceRate: number;
		winRate: number;
		recRate: number;
		topCompetitor: string;
	};
	competitorData: CompetitorData[];
	sentimentBreakdown: {
		positives: { text: string; count: number }[];
		negatives: { text: string; count: number }[];
	};
	brandPerception: {
		bestKnownFor: string | null;
		pricingPerception: string;
		coreClaims: string[];
		differentiators: string[];
	};
	sourcesIntelligence: SourceData[];
	aggregatedRisks: RiskData[];
	groupedRecords: GroupedRecord[];
	analyzedRecords: AnalysisRecord[];
}

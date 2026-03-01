export interface DashboardCompetitorData {
	name: string;
	domain: string;
	appearances: number;
	visibility?: number;
	avgSentiment: number;
	avgRank: number | null;
	recCount: number;
	winsOver: string[];
	losesTo: string[];
	isBrand?: boolean;
}

export interface DashboardSourceData {
	domain: string;
	favicon: string | null;
	citationCount: number;
	uniqueRecords: Set<string>;
	models: Set<string>;
}

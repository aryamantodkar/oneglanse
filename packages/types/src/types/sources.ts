import type { ByModel } from "./metrics.js";
import type { PromptResponse } from "./prompts.js";

export interface Source {
	title: string;
	cited_text: string;
	url: string;
	domain: string | null;
	favicon?: string | null;
}

export interface SourceLookup {
	sources: Source[];
}

// Sources page UI

export type DomainStats = {
	domain: string;
	totalOccurrences: number;
	sourceTextCount: number;
	usedPercentageAcrossAllDomains: number;
	avgSourcesPerDomain: number;
};

export type DomainResponseClient = {
	responses: PromptResponse[];
	domain_stats: DomainStats[];
};

export type SourceExcerpt = {
	cited_text: string;
	model_provider?: string;
};

export type GroupedSource = {
	title: string;
	url: string;
	excerpts: SourceExcerpt[];
	totalSources: number;
};

export type SourceGroupResult = {
	combined: GroupedSource[];
	byModel: ByModel<GroupedSource>;
};

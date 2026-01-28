import type { ByModel } from "./metrics.js";
import type { PromptResponse } from "./prompts.js";

export interface Source {
    title: string;
    citedText: string;
    url: string;
    domain: string | null;
    favicon?: string | null;
}

export interface Citation {
    title: string;
    url: string;
    start_index: number | null;
    end_index: number | null;
    cited_text: string;
}

export interface SourceCitationLookup {
    sources: Source[];
    citations: Citation[];
}

// Sources page UI

export type DomainStats = {
    domain: string;
    totalOccurrences: number;
    citationTextCount: number;
    usedPercentageAcrossAllDomains: number;
    avgCitationsPerDomain: number;
};

export type ModelFilterDomainStats = {
    combined: DomainStats[];
    byModel: ByModel<DomainStats>;
};

export type DomainResponseClient = {
    responses: PromptResponse[],
    domain_stats: DomainStats[]
}

export type CitationExcerpt = {
    cited_text: string;
    start_index: number | null;
    end_index: number | null;
    model_provider?: string;
};

export type GroupedCitation = {
    title: string;
    url: string;
    citations: CitationExcerpt[];
    totalCitations: number;
};

export type CitationGroupResult = {
    combined: GroupedCitation[];
    byModel: ByModel<GroupedCitation>;
};



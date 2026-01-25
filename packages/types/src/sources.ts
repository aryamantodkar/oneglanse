import type { Id } from "./common";

export interface Source {
  title: string;
  url: string;
  page_age: string;
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

/** model_provider -> items[] */
export type ByModel<T> = Record<Id, T[]>;

export type ModelFilterDomainStats = {
  combined: DomainStats[];
  byModel: ByModel<DomainStats>;
};

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

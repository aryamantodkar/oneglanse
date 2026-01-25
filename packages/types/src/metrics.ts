import type { SourceCitationLookup, ByModel } from "./sources";
import type { Id } from "./common";
import type { PromptRunMap } from "./prompts";

// Re-export ByModel for backwards compatibility
export type { ByModel } from "./sources";

/** brand_name -> metric */
export type BrandMetricMap = Record<Id, BrandMetric>;

export interface AnalysisModelInput {
  model_provider: string;
  response: string;
}

export interface Metric extends AnalysisModelInput, SourceCitationLookup {
  brandMetrics: BrandMetricMap;
  promptRunAt: string;
}

export type GroupedMetrics = PromptRunMap<Metric>;

export type BrandMetric = {
  mentions: number;
  sentiment: number;
  visibility: number;
  position: number;
  website: string;
};

export type BrandFilter = {
  name: string;
  website: string;
};

export type FilterMetricsParams = {
  modelFilter: string;
  timeFilter: "all" | "7d" | "14d" | "30d";
  brandFilter?: BrandFilter | null;
};

// Domain response type using PromptResponse (moved from sources to avoid circular import)
export type DomainResponseClient = {
  responses: import("./prompts").PromptResponse[];
  domain_stats: import("./sources").DomainStats[];
};

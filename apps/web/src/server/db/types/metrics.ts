import type { AnalysisModelInput, Id, PromptRunMap, SourceCitationLookup } from "../types";

/** model_provider -> items[] */
export type ByModel<T> = Record<Id, T[]>;

/** brand_name -> metric */
export type BrandMetricMap = Record<Id, BrandMetric>;

export interface Metric extends AnalysisModelInput, SourceCitationLookup {
    brandMetrics: BrandMetricMap;
    promptRunAt: string;
};

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
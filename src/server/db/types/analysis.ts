import type { BrandMetricMap, PromptDetails, PromptRunMap } from "../types";

export interface AnalysisModelInput {
    model_provider: string;
    response: string;
}
  
export interface AnalysisModelOutput extends AnalysisModelInput {
    brandMetrics: BrandMetricMap;
};

export type AnalysisInput = PromptRunMap<AnalysisModelInput>;

export type AnalysisOutput= PromptRunMap<AnalysisModelOutput>;

export interface AnalysedPrompt extends PromptDetails {
    model_provider: string;
    brand_metrics: BrandMetricMap;
    prompt_run_at: string;              
    created_at: string;                
};
import type { BrandMetricMap, AnalysisModelInput } from "./metrics";
import type { PromptDetails, PromptRunMap } from "./prompts";

// Re-export for backwards compatibility
export type { SourceCitationLookup } from "./sources";
export type { AnalysisModelInput } from "./metrics";

export interface AnalysisModelOutput extends AnalysisModelInput {
  brandMetrics: BrandMetricMap;
}

export type AnalysisInput = PromptRunMap<AnalysisModelInput>;

export type AnalysisOutput = PromptRunMap<AnalysisModelOutput>;

export interface AnalysedPrompt extends PromptDetails {
  model_provider: string;
  brand_metrics: BrandMetricMap;
  prompt_run_at: string;
  created_at: string;
}

import { BrandFilter, BrandMetricMap } from "./metrics.js";
import type { Source } from "./sources.js";

export interface AnalysisFilters {
    modelFilter?: string;
    timeFilter?: "all" | "7d" | "14d" | "30d";
    brandFilter?: BrandFilter | null;
    promptId?: string;  // For detail view
}

/** Input for single response analysis */
export interface AnalysisInputSingle {
    response: string;
    sources: Source[];
}

/** Output from single response analysis - raw LLM output */
export interface AnalysisOutputSingle {
    brands: LLMBrandAnalysis[];
}

/** Detailed brand analysis from LLM - matches schema in analysisPrompt */
export interface LLMBrandAnalysis {
    brand_name: string;
    mention_count: number;
    first_mention_position: number;
    visibility: {
        rank: number;
        visibility_score: number;
        is_recommended: boolean;
        recommendation_evidence: string | null;
        placement: "primary_recommendation" | "top_listed" | "listed" | "mentioned_in_passing" | "negative_mention" | "comparison_only";
        in_conclusion: boolean;
    };
    sentiment: {
        overall: "positive" | "negative" | "mixed" | "neutral";
        score: number;
        positive_signals: string[];
        negative_signals: string[];
        qualifiers: string[];
    };
    claims: {
        features: string[];
        pricing: {
            mentioned: boolean;
            details: string | null;
            positioning: "free" | "budget" | "mid_range" | "premium" | "enterprise" | null;
        };
        use_case: string | null;
        differentiator: string | null;
    };
    competitive_context: {
        compared_with: string[];
        positioned_above: string[];
        positioned_below: string[];
        comparison_evidence: string | null;
    };
    source_attributions: Array<{
        source_domain: string;
        source_url: string;
        source_title: string;
        cited_claim: string;
    }>;
}

export interface AnalysisModelInput {
    model_provider: string;
    response: string;
}

/** PromptAnalysis as stored in ClickHouse - brand_metrics is stringified */
export interface PromptAnalysis {
    id: string,
    prompt_id: string,
    workspace_id: string,
    user_id: string,
    model_provider: string,
    brand_metrics: string,  // JSON string in ClickHouse
    prompt_run_at: string,
    created_at: string
}

/** Single analysis record - flat structure for easy filtering */
export interface AnalysisRecord {
    // Identifiers
    id: string;
    prompt_id: string;
    prompt_run_at: string;

    // User context
    user_id: string;
    workspace_id: string;

    // Model info
    model_provider: string;

    // Response data
    response: string;
    sources: Source[];

    // Metrics (already parsed from JSON)
    brand_metrics: BrandMetricMap;

    // Timestamps
    created_at: string;
}

/** Metadata about available filters */
export interface AnalysisMetadata {
    available_brands: Array<{
        name: string;
        website: string;
    }>;
    available_models: string[];
}

/** Complete analysis response */
export interface AnalysisResponse {
    records: AnalysisRecord[];
    metadata: AnalysisMetadata;
}

export interface AnalysisRow {
    id: string;
    prompt_id: string;
    prompt_run_at: string;
    user_id: string;
    workspace_id: string;
    model_provider: string;
    response: string;
    brand_metrics: string | BrandMetricMap;
    sources: Source[];
    created_at: string;
}
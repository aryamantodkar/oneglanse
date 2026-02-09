import { BrandMetricMap } from "./metrics.js";
import type { Source } from "./sources.js";

export interface AnalysisFilters {
    modelFilter?: string;
    timeFilter?: "all" | "7d" | "14d" | "30d";
    promptId?: string;  // For detail view
}

/** Input for single response analysis */
export interface AnalysisInputSingle {
    brandDomain: string;
    brandName: string;
    response: string;
    sources: Source[];
}

/** Detailed brand analysis from LLM - matches schema in analysisPrompt */
export interface LLMBrandAnalysis {
    target_brand: {
        brand_name: string;
        brand_website: string;
        
        brand_presence: {
          total_mentions: number;
          direct_mentions: number;
          indirect_mentions: number;
          source_mentions: number;
          product_mentions: {
            count: number;
            products_named: string[];
          };
          mention_contexts: Array<{
            mention_text: string;
            mention_type: 'direct' | 'indirect' | 'product' | 'source_citation' | 'comparison';
            character_position: number;
          }>;
          first_mention_position: number | null;
          presence_strength: 'dominant_focus' | 'major_presence' | 'moderate_presence' | 
                            'minor_presence' | 'barely_mentioned' | 'not_mentioned';
        };
        
        visibility: {
          rank: number | null;
          visibility_score: number;
          share_of_voice: number;
          is_recommended: boolean;
          recommendation_evidence: string | null;
          recommendation_strength: 'primary_choice' | 'strong_option' | 'among_options' | 
                                   'mentioned_only' | 'not_recommended' | 'not_mentioned';
          placement: 'primary_recommendation' | 'top_listed' | 'listed' | 
                     'mentioned_in_passing' | 'negative_mention' | 'comparison_only' | 'not_mentioned';
          in_conclusion: boolean;
        };
        
        sentiment: {
          overall: 'positive' | 'negative' | 'mixed' | 'neutral' | 'not_mentioned';
          score: number;
          positive_signals: string[];
          negative_signals: string[];
          qualifiers: string[];
          sentiment_summary: string;
        };
        
        brand_narrative: {
          key_message: string | null;
          features_highlighted: string[];
          strengths_cited: string[];
          weaknesses_cited: string[];
          pricing: {
            mentioned: boolean;
            details: string | null;
            positioning: 'free' | 'budget' | 'mid_range' | 'premium' | 'enterprise' | null;
            price_sentiment: 'value' | 'expensive' | 'competitive' | 'unclear' | null;
          };
          target_audience: string | null;
          unique_value_prop: string | null;
          use_cases_mentioned: string[];
        };
        
        competitive_intelligence: {
          total_competitors_mentioned: number;
          direct_comparisons: Array<{
            competitor_name: string;
            competitor_website: string;
            competitor_mention_count: number;
            comparison_type: 'head_to_head' | 'alternative' | 'inferior_to_target' | 
                            'superior_to_target' | 'neutral_comparison';
            comparison_evidence: string;
            target_brand_wins_on: string[];
            competitor_wins_on: string[];
            competitive_gap: string | null;
          }>;
          competitive_positioning: 'market_leader' | 'top_contender' | 'solid_option' | 
                                  'niche_player' | 'underdog' | 'not_positioned' | 'not_mentioned';
          threats_identified: string[];
          opportunities_identified: string[];
        };
        
        source_analysis: {
          sources_citing_target: Array<{
            source_domain: string;
            source_url: string;
            source_title: string;
            cited_claim: string;
            source_sentiment: 'positive' | 'negative' | 'neutral';
            source_credibility: 'official' | 'authoritative' | 'third_party' | 'user_generated' | 'unknown';
          }>;
          official_brand_sources: number;
          authoritative_sources: number;
          third_party_validation: boolean;
        };
      };
      
      market_context: {
        category: string | null;
        all_brands_mentioned: Array<{
          brand_name: string;
          brand_website: string;
          mention_count: number;
          visibility_rank: number;
          is_target_brand: boolean;
        }>;
        target_brand_ranking: number | null;
        market_leaders_identified: string[];
        response_tone: 'buying_guide' | 'comparison' | 'review' | 'educational' | 'promotional' | 'negative';
      };
      
      action_items: {
        visibility_gap: string | null;
        messaging_opportunities: string[];
        reputation_risks: string[];
        content_gaps: string[];
        competitive_threats: string[];
      };
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
    full_analysis?: string,  // NEW - complete LLMBrandAnalysis array as JSON string
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

    // Metrics (already parsed from JSON, empty object if not analyzed)
    brand_metrics: BrandMetricMap;

    // NEW - Full analysis data (parsed from JSON if available)
    full_analysis?: LLMBrandAnalysis;  // Complete analysis object

    // Analysis status
    is_analysed?: boolean;  // True if analyzed, false if raw response

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
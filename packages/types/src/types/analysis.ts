import type { BrandMetricMap } from "./metrics.js";
import type { Source } from "./sources.js";

export interface AnalysisFilters {
	modelFilter?: string;
	timeFilter?: "all" | "7d" | "14d" | "30d";
	promptId?: string; // For detail view
}

/** Input for single response analysis */
export interface AnalysisInputSingle {
	brandDomain: string;
	brandName: string;
	response: string;
	prompt: string;
}

export interface BrandAnalysisResult {
	// Metadata is optional - populated by application code, not from LLM
	metadata?: {
		brandName: string;
		brandDomain: string;
		prompt: string | null;
		prompt_id: string | null;
		analyzedAt: string;
	};

	/**
	 * THE HEADLINE NUMBER — composite 0-100 score.
	 * "How well is your brand performing in AI responses?"
	 */
	geoScore: {
		overall: number;
		verdict: string;
	};

	/**
	 * PRESENCE — Is the brand there? How prominent?
	 */
	presence: {
		mentioned: boolean;
		mentionCount: number;
		visibility: number;
		prominence:
			| "dominant"
			| "significant"
			| "moderate"
			| "minor"
			| "passing"
			| "absent";
		firstMentionPosition: "top" | "middle" | "bottom" | "absent";
	};

	/**
	 * POSITION — Where does the brand rank?
	 */
	position: {
		rankPosition: number | null;
		totalRanked: number | null;
		isTopPick: boolean;
		isTopThree: boolean;
		rankingContext: string | null;
	};

	/**
	 * SENTIMENT — How favorably is the brand portrayed?
	 */
	sentiment: {
		score: number;
		label:
			| "very_negative"
			| "negative"
			| "neutral"
			| "positive"
			| "very_positive";
		positives: string[];
		negatives: string[];
	};

	/**
	 * RECOMMENDATION — Is the LLM actively pushing users toward this brand?
	 */
	recommendation: {
		type:
			| "top_pick"
			| "strong_alternative"
			| "conditional"
			| "mentioned_only"
			| "discouraged"
			| "not_mentioned";
		bestFor: string[];
		caveats: string[];
	};

	/**
	 * COMPETITIVE LANDSCAPE — Who else is in the response and how do they compare?
	 */
	competitors: {
		name: string;
		domain: string;
		visibility: number;
		sentiment: number;
		rankPosition: number | null;
		isRecommended: boolean;
		winsOver: string[];
		losesTo: string[];
	}[];

	/**
	 * BRAND PERCEPTION — What narrative is the LLM building about this brand?
	 */
	perception: {
		coreClaims: string[];
		differentiators: string[];
		bestKnownFor: string | null;
		pricingPerception:
			| "premium"
			| "mid_range"
			| "budget"
			| "free"
			| "not_mentioned";
	};

	/**
	 * RISK ALERTS — Things the brand needs to fix or monitor
	 */
	risks: {
		hasRisks: boolean;
		items: {
			type:
				| "outdated_info"
				| "factual_error"
				| "brand_confusion"
				| "negative_association"
				| "missing_from_response";
			severity: "critical" | "warning" | "info";
			detail: string;
		}[];
	};

	/**
	 * ACTIONABLE RECOMMENDATIONS — What should the brand do next?
	 */
	actions: {
		priority: "critical" | "high" | "medium" | "low";
		recommendation: string;
	}[];
}

export interface AnalysisModelInput {
	model_provider: string;
	response: string;
}

/** PromptAnalysis as stored in ClickHouse  */
export interface PromptAnalysis {
	id: string;
	prompt_id: string;
	workspace_id: string;
	user_id: string;
	model_provider: string;
	prompt: string; // Store for convenience, though prompt is in prompt_responses too
	brand_analysis: string; // Complete BrandAnalysisResult as JSON string
	prompt_run_at: string;
	created_at: string;
}

/** Single analysis record - flat structure for easy filtering */
export interface AnalysisRecord {
	// Identifiers
	id: string;
	prompt_id: string;
	prompt_run_at: string;
	prompt: string;

	// User context
	user_id: string;
	workspace_id: string;

	// Model info
	model_provider: string;

	// Response data
	response: string;
	sources: Source[];

	// NEW - Full analysis data (parsed from JSON if available)
	brand_analysis?: BrandAnalysisResult; // Complete analysis object

	// Analysis status
	is_analysed?: boolean; // True if analyzed, false if raw response

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

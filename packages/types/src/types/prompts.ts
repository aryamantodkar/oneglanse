import type { AnalysisModelInput } from "./analysis.js";
import type { SourceLookup } from "./sources.js";

export type UserPrompt = {
	id: string;
	user_id: string;
	workspace_id: string;
	prompt: string;
	created_at: string;
};

export type PromptPayload = {
	user_id: string;
	workspace_id: string;
	prompts: {
		id: string;
		prompt: string;
	}[];
	created_at: string;
};

export interface PromptDetails {
	id: string;
	prompt_id: string;
	user_id: string;
	workspace_id: string;
}

/** prompt_id -> prompt_run_at -> models[] */
export type PromptRunMap<T> = Record<string, Record<string, T[]>>;

export interface PromptAnalysisBase extends PromptDetails, AnalysisModelInput {
	model: string;
}

export interface PromptAnalysisWithSources
	extends PromptAnalysisBase,
		SourceLookup {}

export interface PromptResponse extends PromptAnalysisWithSources {
	prompt: string;
	prompt_run_at: string;
	created_at: string;
	is_analysed: boolean;
}

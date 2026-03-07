import type { Source } from "./sources.js";
import type { UserPrompt } from "./prompts.js";

// Agent-specific types shared between web and agent apps
export interface AgentCitation {
	text: string;
	href?: string | null;
	title?: string | null;
	ariaLabel?: string | null;
	type?: "link" | "superscript" | "button";
}

export interface ContentBlock {
	text: string;
	tag: string;
	citations?: AgentCitation[];
}

export interface ExtractionResult {
	response: string;
	contentBlocks: ContentBlock[];
	inlineCitations: AgentCitation[];
	sources: Source[];
	hasSourcesButton: boolean;
	extractionErrors: string[];
}

export interface AskPromptResult {
	userId: string;
	workspaceId: string;
	promptId: string;
	prompt: string;
	response: string;
	sources: Source[];
}

export const PROVIDER_LIST = [
	"chatgpt",
	"claude",
	"perplexity",
	"gemini",
	"ai-overview",
] as const;

export type Provider = (typeof PROVIDER_LIST)[number];

// Execution order for chained single-browser runs
export const CHAIN_ORDER: Provider[] = ["chatgpt", "perplexity", "gemini", "ai-overview"];

export type ChainJobData = {
	jobGroupId: string;
	prompts: UserPrompt[];
	user_id: string;
	workspace_id: string;
	enabledProviders: Provider[];
};

export type AgentResult = {
	status: "fulfilled" | "rejected";
	data: AskPromptResult[];
};

export type ModelResult = Record<Provider, AgentResult>;

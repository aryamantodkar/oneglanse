import type { UserPrompt } from "./prompts.js";
import type { Source } from "./sources.js";

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
	"perplexity",
	"gemini",
	"claude",
	"ai-overview",
] as const;

export type Provider = (typeof PROVIDER_LIST)[number];

export const AUTH_PROVIDER_LIST = [
	"chatgpt",
	"perplexity",
	"google",
	"claude",
] as const;

export type AuthProvider = (typeof AUTH_PROVIDER_LIST)[number];

export interface ProviderAuthStatus {
	provider: AuthProvider;
	connected: boolean;
	connecting: boolean;
	synced: boolean;
	lastUpdatedAt: string | null;
	syncedAt: string | null;
	error: string | null;
}

export type AgentResult = {
	status: "fulfilled" | "rejected";
	data: AskPromptResult[];
};

export type ModelResult = Record<Provider, AgentResult>;

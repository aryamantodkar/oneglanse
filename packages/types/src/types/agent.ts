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

export const APP_MODE_LIST = ["cloud", "self-hosted", "local"] as const;

export type AppMode = (typeof APP_MODE_LIST)[number];

export function resolveAppMode(rawMode?: string | null): AppMode {
	if (rawMode === "self-hosted" || rawMode === "local") {
		return rawMode;
	}

	return "cloud";
}

export function canAccessScheduleInMode(appMode: AppMode): boolean {
	return appMode !== "cloud";
}

export function shouldUseProxyInMode(appMode: AppMode): boolean {
	return appMode !== "local";
}

export function isInteractiveAuthAllowedInMode(appMode: AppMode): boolean {
	return appMode === "local";
}

export const AUTH_PROVIDER_LIST = [
	"chatgpt",
	"perplexity",
	"gemini",
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

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
	return true;
}

export function canConfigureRecurringScheduleInMode(appMode: AppMode): boolean {
	return appMode !== "local";
}

export function canRunPromptsNowInMode(appMode: AppMode): boolean {
	return appMode === "local";
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

// Selector intelligence types — shared between selectors modules

export type SelectorStage = "compose" | "submit" | "response" | "sources";
export type SelectorField =
	| "editor"
	| "submitButton"
	| "response"
	| "generationIndicator"
	| "sourcesButton"
	| "sourcePanel"
	| "sourceItem";

export type SnapshotCandidate = {
	selector: string;
	tag: string;
	role: string | null;
	type: string | null;
	top: number;
	height: number;
	depth: number;
	text: string;
	textLength: number;
	name: string | null;
	ariaLabel: string | null;
	placeholder: string | null;
	linkCount: number;
	buttonCount: number;
	inputLike: boolean;
	buttonLike: boolean;
	contentEditable: boolean;
	disabled: boolean;
	groupCount?: number;
	sampleItems?: Array<{
		text: string;
		linkCount: number;
		buttonCount: number;
	}>;
	fingerprint: string;
};

export type SelectorSnapshot = {
	stage: SelectorStage;
	url: string;
	title: string;
	pageKey: string;
	fingerprint: string;
	editables: SnapshotCandidate[];
	buttons: SnapshotCandidate[];
	content: SnapshotCandidate[];
	groups: SnapshotCandidate[];
};

export type SelectorProfile = {
	version: number;
	provider: Provider;
	stage: SelectorStage;
	pageKey: string;
	fingerprint: string;
	model: string;
	createdAt: string;
	selectors: Record<SelectorField, string[]>;
};

export type ProviderSelectorCache = {
	version: number;
	provider: Provider;
	updatedAt: string;
	profiles: SelectorProfile[];
};

export type PageFailureCooldown = {
	expiresAt: number;
	stateKey: string;
};

export type ModelCandidate = Pick<
	SnapshotCandidate,
	| "selector"
	| "tag"
	| "role"
	| "type"
	| "top"
	| "height"
	| "depth"
	| "text"
	| "textLength"
	| "name"
	| "ariaLabel"
	| "placeholder"
	| "linkCount"
	| "buttonCount"
	| "inputLike"
	| "buttonLike"
	| "contentEditable"
	| "disabled"
	| "groupCount"
	| "sampleItems"
	| "fingerprint"
>;

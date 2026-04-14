import type { Source } from "./sources.js";

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

export const APP_MODE_LIST = ["cloud", "self-host", "local"] as const;

export type AppMode = (typeof APP_MODE_LIST)[number];

export function resolveAppMode(rawMode?: string | null): AppMode {
	if (rawMode === "self-host" || rawMode === "local") {
		return rawMode;
	}

	return "cloud";
}

export function canAccessScheduleInMode(appMode: AppMode): boolean {
	return true;
}

export function canAccessPeopleInMode(appMode: AppMode): boolean {
	return appMode !== "local";
}

export function canAccessProvidersInMode(appMode: AppMode): boolean {
	return appMode !== "cloud";
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

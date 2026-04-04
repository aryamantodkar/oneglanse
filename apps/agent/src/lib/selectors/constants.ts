import type {
	PageFailureCooldown,
	SelectorProfile,
	SelectorStage,
} from "@oneglanse/types";

export const SELECTOR_PROFILE_VERSION = 1;
export const SELECTOR_MODEL = "gpt-4.1";
export const MAX_SELECTORS_PER_FIELD = 5;
export const FAILED_RESOLUTION_TTL_MS = 2_000;
export const PAGE_FAILED_RESOLUTION_TTL_MS = 5_000;
export const SELECTOR_MODEL_RATE_LIMIT_TTL_MS = 15 * 60_000;
export const MAX_SELECTOR_MODEL_CALLS_PER_PROCESS = 30;
export const SNAPSHOT_STABILITY_POLL_MS = 250;
export const SNAPSHOT_STABLE_POLLS_REQUIRED = 2;
export const SNAPSHOT_STABILITY_TIMEOUT_MS: Record<SelectorStage, number> = {
	compose: 3_000,
	submit: 3_000,
	response: 8_000,
	sources: 5_000,
};

export const pendingResolutions = new Map<string, Promise<SelectorProfile | null>>();
// Tracks provider:stage pairs where an LLM resolution is currently in-flight.
// Checked before captureStableSelectorSnapshot() to skip expensive DOM work.
export const pendingByProviderStage = new Set<string>();
export const failedResolutions = new Map<string, number>();
export const failedPageResolutions = new Map<string, PageFailureCooldown>();

export const selectorModelState = {
	callsThisProcess: 0,
	disabledUntil: 0,
	budgetLogged: false,
	rateLimitLogged: false,
};
